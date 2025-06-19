import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import session from 'express-session';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import {
  RekognitionClient,
  DetectLabelsCommand,
  RecognizeCelebritiesCommand
} from '@aws-sdk/client-rekognition';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Rekognition client
const rekognitionClient = new RekognitionClient({
  region: process.env.REKOGNITION_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src'))); // Serve login UI files

app.use(session({
  secret: 'your-secret-key', // change to secure random in prod
  resave: false,
  saveUninitialized: false,
}));

// 🔐 Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.redirect('/login');
  }
}

// 👤 Login page
// Update this route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// 👤 Handle login from frontend (after Cognito token is received)
app.post('/session-login', (req, res) => {
  const { token } = req.body;

  // OPTIONAL: Validate token using AWS Cognito public keys here
  if (token) {
    req.session.isAuthenticated = true;
    res.status(200).send('Login successful');
  } else {
    res.status(400).send('Invalid login');
  }
});

// 👤 Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ✅ Default route redirects to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// 📤 Image Upload (protected)
const upload = multer({ dest: 'uploads/' });

app.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).send('No image uploaded!');

  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    const ext = path.extname(req.file.originalname);
    const imageName = req.file.filename + ext;

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: imageName,
      Body: fs.createReadStream(req.file.path),
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    }));

    const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}`;

    // Detect labels
    const labelResponse = await rekognitionClient.send(new DetectLabelsCommand({
      Image: { S3Object: { Bucket: bucketName, Name: imageName } },
      MaxLabels: 10,
      MinConfidence: 70.0,
    }));

    const labelsWithBoxes = labelResponse.Labels
      .map(label => ({
        name: label.Name,
        confidence: label.Confidence.toFixed(2),
        boxes: (label.Instances && label.Instances.length > 0)
          ? label.Instances.map(instance => instance.BoundingBox)
          : []
      }))
      .filter(label => label.boxes.length > 0);

    // Detect celebrity faces
    const celebResponse = await rekognitionClient.send(new RecognizeCelebritiesCommand({
      Image: { S3Object: { Bucket: bucketName, Name: imageName } }
    }));

    const celebrities = celebResponse.CelebrityFaces.map(celeb => ({
      name: celeb.Name,
      confidence: celeb.MatchConfidence.toFixed(2),
      urls: celeb.Urls,
      box: celeb.Face.BoundingBox
    }));

    // Delete local file
    fs.unlink(req.file.path, err => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    // Redirect to display with results
    res.redirect(`/display?image=${encodeURIComponent(imageUrl)}&data=${encodeURIComponent(JSON.stringify(labelsWithBoxes))}&celebs=${encodeURIComponent(JSON.stringify(celebrities))}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing image.');
  }
});

// 🖼 Display result (protected)
app.get('/display', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
