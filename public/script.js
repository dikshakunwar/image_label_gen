// Animation toggles
const wrapper = document.querySelector('.wrapper');
const signUpLink = document.querySelector('.signUp-link');
const signInLink = document.querySelector('.signIn-link');

if (signUpLink && signInLink && wrapper) {
  signUpLink.addEventListener('click', () => {
    wrapper.classList.add('animate-signIn');
    wrapper.classList.remove('animate-signUp');
  });

  signInLink.addEventListener('click', () => {
    wrapper.classList.add('animate-signUp');
    wrapper.classList.remove('animate-signIn');
  });
}

// SIGNUP FUNCTIONALITY
document.getElementById('signupForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const username = document.getElementById('signupUsername').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })
  ];

  userPool.signUp(username, password, attributeList, null, function (err, result) {
    if (err) {
      alert(err.message || JSON.stringify(err));
      return;
    }

   document.getElementById('confirmationPopup').style.display = 'flex';

// Save the username to use for confirmation
window.cognitoUsername = username;
window.cognitoUserPool = userPool;
  });
});

// LOGIN FUNCTIONALITY
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: username,
    Password: password
  });

  const userData = {
    Username: username,
    Pool: userPool
  };

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: function (result) {
      // Send token to backend to establish session
      fetch('/session-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.getIdToken().getJwtToken()
        })
      }).then(res => {
        if (res.ok) {
          window.location.href = './upload.html'; // Protected homepage
        } else {
          alert("Session setup failed. Please try again.");
        }
      });
    },

    onFailure: function (err) {
      alert(err.message || JSON.stringify(err));
    }
  });
});
document.getElementById('confirmCodeBtn').addEventListener('click', function () {
  const code = document.getElementById('confirmationCodeInput').value.trim();
  if (!code) {
    alert('Please enter the confirmation code.');
    return;
  }

  const username = window.cognitoUsername;
  if (!username) {
    alert('No user found for confirmation.');
    return;
  }

  // Create CognitoUser to confirm registration
  const userData = {
    Username: username,
    Pool: window.cognitoUserPool
  };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  cognitoUser.confirmRegistration(code, true, function (err, result) {
    if (err) {
      alert(err.message || JSON.stringify(err));
      return;
    }
    alert('Email confirmed successfully! You can now log in.');

    // Hide the confirmation popup
    document.getElementById('confirmationPopup').style.display = 'none';

    // Switch to login form view
    wrapper.classList.add('animate-signUp');
    wrapper.classList.remove('animate-signIn');
  });
});

document.getElementById('cancelConfirmBtn').addEventListener('click', function () {
  // Hide popup and switch to login form
  document.getElementById('confirmationPopup').style.display = 'none';
  wrapper.classList.add('animate-signUp');
  wrapper.classList.remove('animate-signIn');
});
