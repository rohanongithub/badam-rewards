// Check if user is already signed in
async function checkAuth() {
  try {
    const response = await fetch('/api/user');
    if (response.ok) {
      window.location.href = '/main.html';
    }
  } catch (error) {
    // Not authenticated, stay on sign-in page
  }
  
  // Check for OAuth error in URL
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  if (error === 'google_auth_failed') {
    showError('Google authentication failed. Please try again.');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 5000);
}

// Sign in form handler
document.getElementById('signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      window.location.href = '/main.html';
    } else {
      showError(data.error || 'Sign in failed');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
});

// Sign up form handler
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Auto-logged in after signup, redirect to main page
      window.location.href = '/main.html';
    } else {
      showError(data.error || 'Sign up failed');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
});

// Toggle between sign in and sign up forms
document.getElementById('show-signup').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signin-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
  document.getElementById('show-signup').parentElement.style.display = 'none';
  document.getElementById('switch-to-signin').style.display = 'block';
});

document.getElementById('show-signin').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('signin-form').style.display = 'block';
  document.getElementById('switch-to-signin').style.display = 'none';
  document.getElementById('show-signup').parentElement.style.display = 'block';
});

// Google Sign-In button handler
document.getElementById('google-signin-btn').addEventListener('click', () => {
  window.location.href = '/api/auth/google';
});

// Google Sign-Up button handler
document.getElementById('google-signup-btn').addEventListener('click', () => {
  window.location.href = '/api/auth/google';
});

// Check auth on page load
checkAuth();

