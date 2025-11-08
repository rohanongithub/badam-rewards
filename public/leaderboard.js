// Check authentication
async function checkAuth() {
  try {
    const response = await fetch('/api/user');
    if (!response.ok) {
      window.location.href = '/index.html';
      return;
    }
    const data = await response.json();
    loadLeaderboard();
  } catch (error) {
    window.location.href = '/index.html';
  }
}

// Load leaderboard data
async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard?limit=10');
    if (!response.ok) {
      throw new Error('Failed to load leaderboard');
    }
    
    const data = await response.json();
    displayLeaderboard(data.leaderboard);
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    document.getElementById('leaderboard-container').innerHTML = 
      '<div class="error-message">Failed to load leaderboard. Please try again.</div>';
  }
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
  const container = document.getElementById('leaderboard-container');
  
  if (leaderboard.length === 0) {
    container.innerHTML = '<div class="no-data">No users yet. Be the first to earn Badams!</div>';
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  
  const html = leaderboard.map((user, index) => {
    const rank = index + 1;
    const medal = rank <= 3 ? medals[rank - 1] : '';
    const rankDisplay = rank <= 3 ? medal : `#${rank}`;
    
    return `
      <div class="leaderboard-item ${rank <= 3 ? 'top-three' : ''}">
        <div class="rank">${rankDisplay}</div>
        <div class="user-info">
          <div class="username">${escapeHtml(user.username)}</div>
          <div class="user-meta">Joined ${formatDate(user.created_at)}</div>
        </div>
        <div class="badam-count">
          <span class="count-number">${user.count}</span>
          <span class="count-label">Badams</span>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'today';
  if (diffDays === 2) return 'yesterday';
  if (diffDays < 7) return `${diffDays - 1} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Sign out handler
document.getElementById('signout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/signout', { method: 'POST' });
    window.location.href = '/index.html';
  } catch (error) {
    console.error('Error signing out:', error);
  }
});

// Check auth on page load
checkAuth();

