// Local count and debounce timer
let currentCount = 0;
let debounceTimer = null;

// Check authentication and load user data
async function checkAuth() {
  try {
    const response = await fetch('/api/user');
    if (!response.ok) {
      window.location.href = '/index.html';
      return;
    }
    const data = await response.json();
    document.getElementById('username').textContent = data.username;
    
    // Display avatar if available
    const header = document.querySelector('.header h1');
    if (data.avatar_url) {
      // Add avatar image if not already present
      let avatarImg = document.getElementById('user-avatar');
      if (!avatarImg) {
        avatarImg = document.createElement('img');
        avatarImg.id = 'user-avatar';
        avatarImg.className = 'user-avatar';
        avatarImg.src = data.avatar_url;
        avatarImg.alt = data.username;
        header.insertBefore(avatarImg, header.firstChild);
      } else {
        avatarImg.src = data.avatar_url;
      }
    } else {
      // Remove avatar if present but user doesn't have one
      const avatarImg = document.getElementById('user-avatar');
      if (avatarImg) {
        avatarImg.remove();
      }
    }
    
    await loadBadamCount();
  } catch (error) {
    window.location.href = '/index.html';
  }
}

// Load badam count from server
async function loadBadamCount() {
  try {
    const response = await fetch('/api/badam');
    if (response.ok) {
      const data = await response.json();
      currentCount = data.count;
      document.getElementById('badam-count').textContent = currentCount;
    }
  } catch (error) {
    console.error('Error loading badam count:', error);
  }
}

// Update badam count immediately in UI, then sync to DB after 10 seconds
function updateBadamCount(action) {
  // Update count immediately (optimistic update)
  if (action === 'increment') {
    currentCount += 1;
  } else if (action === 'decrement') {
    currentCount = Math.max(0, currentCount - 1);
  }
  
  // Update UI immediately
  document.getElementById('badam-count').textContent = currentCount;
  
  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Set new timer to sync with database after 10 seconds
  debounceTimer = setTimeout(() => {
    syncBadamCountToDatabase();
  }, 10000); // 10 second delay
}

// Sync the current count to the database
async function syncBadamCountToDatabase() {
  try {
    const response = await fetch('/api/badam/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count: currentCount }),
    });

    if (response.ok) {
      console.log('Badam count synced to database:', currentCount);
    } else {
      console.error('Failed to sync badam count to database');
    }
  } catch (error) {
    console.error('Error syncing badam count to database:', error);
  }
}

// Sign out handler - sync count before signing out
document.getElementById('signout-btn').addEventListener('click', async () => {
  try {
    // Clear any pending timer and sync immediately
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await syncBadamCountToDatabase();
    await fetch('/api/signout', { method: 'POST' });
    window.location.href = '/index.html';
  } catch (error) {
    console.error('Error signing out:', error);
  }
});

// Sync count when page is about to unload (user closes tab/navigates away)
window.addEventListener('beforeunload', () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  // Use fetch with keepalive for reliable sync on page unload
  fetch('/api/badam/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ count: currentCount }),
    keepalive: true
  }).catch(() => {}); // Ignore errors during unload
});

// Increment button
document.getElementById('increment-btn').addEventListener('click', () => {
  updateBadamCount('increment');
});

// Decrement button
document.getElementById('decrement-btn').addEventListener('click', () => {
  updateBadamCount('decrement');
});

// Check auth on page load
checkAuth();

