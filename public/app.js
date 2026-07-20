// -------------------------------------------------------------
// SPOTLITE APP - FRONTEND APPLICATION JAVASCRIPT
// -------------------------------------------------------------

// Utility: Apply chosen profile theme to the body
function applyThemeClass(theme) {
    if (!theme) theme = 'gold';
    // Remove any existing theme- classes
    document.body.className = document.body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
    document.body.classList.add('theme-' + theme);
}

window.savedPostIdsSet = new Set();
async function fetchSavedPostsSet() {
    try {
        const res = await fetch(`${API_BASE}/posts/saved`, {
            headers: getHeaders()
        });
        if (res.ok) {
            const posts = await res.json();
            window.savedPostIdsSet = new Set(posts.map(p => p._id));
        }
    } catch (e) {
        console.error('Failed to fetch saved posts set:', e);
    }
}

// Immediately apply the theme if saved in localStorage
(function() {
    try {
        const cachedUser = JSON.parse(localStorage.getItem('user'));
        if (cachedUser && cachedUser.profileTheme) {
            applyThemeClass(cachedUser.profileTheme);
        } else {
            applyThemeClass('gold');
        }
    } catch (e) {
        applyThemeClass('gold');
    }
})();

const API_BASE = '/api';

// Global Fetch Interceptor to handle expired/invalid tokens
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    if (response.status === 401 || response.status === 403) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            if (data.error && (data.error.toLowerCase().includes('token') || data.error.toLowerCase().includes('denied'))) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                if (!window.location.pathname.includes('auth.html')) {
                    window.location.href = 'auth.html';
                }
            }
        } catch (e) {
            // Ignore JSON parsing errors
        }
    }
    return response;
};

// Utility: Get standard request headers with Authorization token
function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Utility: Convert file to Base64 string
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Utility: Compress image on client side using canvas
function compressImage(file, maxWidth = 1080, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// Utility: Get category badge HTML helper
function getCategoryBadgeHTML(category) {
    if (!category) category = 'General';
    let catClass = 'cat-general';
    let catIcon = '🌟';
    const c = category.toLowerCase();
    if (c.includes('tech') || c.includes('code')) { catClass = 'cat-tech'; catIcon = '💻'; }
    else if (c.includes('art') || c.includes('design')) { catClass = 'cat-art'; catIcon = '🎨'; }
    else if (c.includes('travel') || c.includes('lifestyle')) { catClass = 'cat-travel'; catIcon = '✈️'; }
    else if (c.includes('fitness') || c.includes('health')) { catClass = 'cat-fitness'; catIcon = '🏋️'; }
    else if (c.includes('gaming')) { catClass = 'cat-gaming'; catIcon = '🎮'; }
    else if (c.includes('music')) { catClass = 'cat-music'; catIcon = '🎵'; }
    else if (c.includes('education') || c.includes('study')) { catClass = 'cat-education'; catIcon = '📚'; }
    
    return `<span class="post-category-badge ${catClass}">${catIcon} ${category}</span>`;
}

// Utility: Format timestamp (e.g. "3 hours ago" or "2 days ago")
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
}

// Global Dynamic Action Menu Modal Helper
function showActionMenu(options) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:100000; display:flex; align-items:center; justify-content:center;';
    
    const menu = document.createElement('div');
    menu.style.cssText = 'background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; width:90%; max-width:320px; display:flex; flex-direction:column; overflow:hidden; animation: bubblePop 0.2s ease-out;';
    
    options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.textContent = opt.label;
        btn.style.cssText = `background:none; border:none; padding:14px; font-size:0.9rem; font-weight:600; cursor:pointer; text-align:center; transition:background 0.2s; border-bottom:${idx < options.length - 1 ? '1px solid var(--border-color)' : 'none'}; color:${opt.danger ? 'var(--accent-red)' : 'var(--text-primary)'};`;
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = 'var(--bg-secondary)');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'transparent');
        btn.addEventListener('click', () => {
            overlay.remove();
            opt.onClick();
        });
        menu.appendChild(btn);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'background:none; border:none; padding:14px; font-size:0.9rem; font-weight:550; cursor:pointer; text-align:center; transition:background 0.2s; color:var(--text-muted); border-top:1px solid var(--border-color);';
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.backgroundColor = 'var(--bg-secondary)');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.backgroundColor = 'transparent');
    cancelBtn.addEventListener('click', () => overlay.remove());
    menu.appendChild(cancelBtn);

    overlay.appendChild(menu);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

// Global Dynamic Prompt Text Modal Helper
function showPromptModal(title, defaultValue, onSubmit) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:100000; display:flex; align-items:center; justify-content:center;';

    const content = document.createElement('div');
    content.style.cssText = 'background:var(--bg-card); border:1px solid var(--border-color); border-radius:14px; padding:20px; width:90%; max-width:380px; display:flex; flex-direction:column; gap:14px; animation: bubblePop 0.2s ease-out;';
    
    content.innerHTML = `
        <h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin:0;">${title}</h3>
        <textarea id="prompt-textarea" style="background-color:var(--bg-input); border:1px solid var(--border-color); border-radius:8px; padding:10px; color:var(--text-primary); font-size:0.9rem; min-height:80px; width:100%; box-sizing:border-box; outline:none; resize:vertical; font-family:inherit;"></textarea>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:5px;">
            <button id="prompt-cancel-btn" style="background:none; border:1px solid var(--border-color); border-radius:6px; padding:8px 16px; color:var(--text-secondary); font-weight:600; cursor:pointer;">Cancel</button>
            <button id="prompt-submit-btn" style="background:var(--spotlite-gradient); border:none; border-radius:6px; padding:8px 16px; color:black; font-weight:600; cursor:pointer;">Save</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const textarea = content.querySelector('#prompt-textarea');
    textarea.value = defaultValue;
    textarea.focus();

    content.querySelector('#prompt-cancel-btn').onclick = () => overlay.remove();
    
    content.querySelector('#prompt-submit-btn').onclick = () => {
        const val = textarea.value.trim();
        overlay.remove();
        onSubmit(val);
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

// Global Notification Service Variables & Helpers
let isNotificationServiceStarted = false;
let globalLastMessageTimes = {};

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        
        // Premium two-tone chime
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain2.gain.setValueAtTime(0.1, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.4);
    } catch (e) {
        console.warn('AudioContext failed:', e);
    }
}

function showInAppNotification(title, body, avatarUrl) {
    let container = document.getElementById('toast-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-notification-container';
        container.style.position = 'fixed';
        container.style.top = '25px';
        container.style.right = '25px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.background = 'rgba(18, 18, 18, 0.95)';
    toast.style.backdropFilter = 'blur(12px)';
    toast.style.border = '1px solid rgba(255, 215, 0, 0.25)'; // Gold border
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
    toast.style.transform = 'translateX(130%)';
    toast.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    toast.style.maxWidth = '320px';
    toast.style.cursor = 'pointer';

    // Click on toast takes user to messages page
    toast.addEventListener('click', () => {
        window.location.href = `messages.html?u=${title}`;
    });

    const img = document.createElement('img');
    img.src = avatarUrl || 'spotlite.png';
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.border = '1px solid rgba(255, 215, 0, 0.2)';

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.overflow = 'hidden';

    const sender = document.createElement('span');
    sender.textContent = title;
    sender.style.fontWeight = '700';
    sender.style.fontSize = '0.9rem';
    sender.style.color = '#ffd700'; // Spotlite Gold

    const msgPreview = document.createElement('span');
    msgPreview.textContent = body;
    msgPreview.style.fontSize = '0.82rem';
    msgPreview.style.color = '#cccccc';
    msgPreview.style.whiteSpace = 'nowrap';
    msgPreview.style.overflow = 'hidden';
    msgPreview.style.textOverflow = 'ellipsis';

    info.appendChild(sender);
    info.appendChild(msgPreview);
    toast.appendChild(img);
    toast.appendChild(info);
    container.appendChild(toast);

    // Slide in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);

    // Slide out
    setTimeout(() => {
        toast.style.transform = 'translateX(130%)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

function setupGlobalNotificationService() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    checkNewMessages(true);
    // Poll for new messages list every 4 seconds
    setInterval(() => checkNewMessages(false), 4000);

    checkNotifications();
    // Poll for notifications every 10 seconds
    setInterval(checkNotifications, 10000);
}

async function checkNewMessages(isInitial = false) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/messages/conversations/list`, {
            headers: getHeaders()
        });
        const conversations = await response.json();
        if (!response.ok) return;

        conversations.forEach(c => {
            const userId = c.user._id;
            const lastMsgTime = new Date(c.lastMessageTime).getTime();

            // If we have a tracked timestamp, and the new message is newer than what we recorded
            if (globalLastMessageTimes[userId] && lastMsgTime > globalLastMessageTimes[userId]) {
                const isCurrentActiveChat = (window.location.pathname.includes('messages.html') && typeof activeChatReceiverId !== 'undefined' && activeChatReceiverId === userId);

                if (!isCurrentActiveChat) {
                    showInAppNotification(c.user.username, c.lastMessage, c.user.avatar);
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(c.user.username, {
                            body: c.lastMessage,
                            icon: c.user.avatar || 'spotlite.png'
                        });
                    }
                    playNotificationSound();
                }
            }
            globalLastMessageTimes[userId] = lastMsgTime;
        });
    } catch (err) {
        console.error('Notification service error:', err);
    }
}

let globalLastNotificationTime = 0;

function getNotificationText(n) {
    switch (n.type) {
        case 'like': return 'liked your post';
        case 'comment': return 'commented on your post';
        case 'follow': return 'started following you';
        case 'mention': return 'mentioned you in a comment';
        default: return 'sent you a notification';
    }
}

async function checkNotifications() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/notifications`, {
            headers: getHeaders()
        });
        const notifications = await response.json();
        if (!response.ok) return;

        const unread = notifications.filter(n => !n.isRead);
        const count = unread.length;

        const badge = document.getElementById('notif-count-badge');
        const mobBadge = document.getElementById('mobile-notif-count-badge');

        if (badge) {
            badge.style.display = count > 0 ? 'inline-block' : 'none';
            badge.textContent = count;
        }
        if (mobBadge) {
            mobBadge.style.display = count > 0 ? 'inline-block' : 'none';
            mobBadge.textContent = count;
        }

        if (notifications.length > 0) {
            const latest = notifications[0];
            const latestTime = new Date(latest.createdAt).getTime();

            if (globalLastNotificationTime > 0 && latestTime > globalLastNotificationTime) {
                if (!latest.isRead) {
                    showInAppNotification(latest.sender.username, getNotificationText(latest), latest.sender.avatar);
                    playNotificationSound();
                }
            }
            globalLastNotificationTime = Math.max(globalLastNotificationTime, latestTime);
        }
    } catch (e) {
        console.error('Notifications check error:', e);
    }
}

function setupNotificationsSliderPanel() {
    const sidebarBtn = document.getElementById('sidebar-notifications-btn');
    const mobileBtn = document.getElementById('mobile-notifications-btn');
    const panel = document.getElementById('notifications-slider-panel');
    const list = document.getElementById('notifications-list');

    if (!panel || !list) return;

    async function openPanel() {
        panel.classList.add('active');
        const searchPanel = document.getElementById('search-slider-panel');
        if (searchPanel) searchPanel.classList.remove('active');

        list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">Loading...</p>';
        try {
            const res = await fetch(`${API_BASE}/notifications`, {
                headers: getHeaders()
            });
            const notifications = await res.json();
            if (!res.ok) throw new Error(notifications.error);

            if (notifications.length === 0) {
                list.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No notifications yet.</div>`;
                return;
            }

            list.innerHTML = '';
            notifications.forEach(n => {
                const row = document.createElement('div');
                row.className = `notification-item ${n.isRead ? '' : 'unread'}`;
                row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;';
                
                const relativeTime = formatTime(n.createdAt);
                const text = getNotificationText(n);
                
                row.innerHTML = `
                    <img src="${n.sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${n.sender.username}`}"
                         style="width:42px;height:42px;border-radius:50%;object-fit:cover;" alt="">
                    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:0.88rem;color:var(--text-primary);">
                            <strong style="font-weight:600;" onclick="window.location.href='profile.html?u=${n.sender.username}'">${n.sender.username}</strong> ${text}
                        </span>
                        <span style="font-size:0.75rem;color:var(--text-muted);">${relativeTime}</span>
                    </div>
                `;

                if (n.type === 'like' || n.type === 'comment' || n.type === 'mention') {
                    row.onclick = (e) => {
                        if (e.target.tagName !== 'STRONG') {
                            if (n.post) openPostDetailModal(n.post._id || n.post);
                        }
                    };
                } else if (n.type === 'follow') {
                    row.onclick = (e) => {
                        if (e.target.tagName !== 'STRONG') {
                            window.location.href = `profile.html?u=${n.sender.username}`;
                        }
                    };
                }

                list.appendChild(row);
            });

            // Mark notifications as read
            fetch(`${API_BASE}/notifications/mark-read`, {
                method: 'POST',
                headers: getHeaders()
            }).then(() => checkNotifications());

        } catch (err) {
            console.error('Error loading panel notifications:', err);
            list.innerHTML = '<p style="color:var(--accent-red); text-align:center; padding: 20px;">Could not load notifications</p>';
        }
    }

    function closePanel() {
        panel.classList.remove('active');
    }

    if (sidebarBtn) sidebarBtn.onclick = (e) => { e.stopPropagation(); openPanel(); };
    if (mobileBtn) mobileBtn.onclick = (e) => { e.stopPropagation(); openPanel(); };

    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== sidebarBtn && e.target !== mobileBtn) {
            closePanel();
        }
    });
}

// Check auth status
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token && !window.location.pathname.includes('auth.html')) {
        window.location.href = 'auth.html';
        return false;
    }
    if (token && !isNotificationServiceStarted) {
        isNotificationServiceStarted = true;
        setupGlobalNotificationService();
    }
    return true;
}

// Logout action
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'auth.html';
    });
}

// --- SETUP SIDEBAR / MOBILE PROFILE LINKS ---
function setupNavigationLinks() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    const sidebarProfile = document.getElementById('sidebar-profile-link');
    const mobileProfile = document.getElementById('mobile-profile-link');

    if (sidebarProfile) sidebarProfile.href = `profile.html?u=${currentUser.username}`;
    if (mobileProfile) mobileProfile.href = `profile.html?u=${currentUser.username}`;

    // Also link user card on the feed page
    const userNav = document.getElementById('current-user-nav');
    if (userNav) {
        userNav.addEventListener('click', () => {
            window.location.href = `profile.html?u=${currentUser.username}`;
        });
    }

    setupNotificationsSliderPanel();
}

// =============================================================
// AUTHENTICATION LOGIC (auth.html)
// =============================================================
function initAuthPage() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const verifyForm = document.getElementById('verify-form');

    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const verifyError = document.getElementById('verify-error');
    const verifySuccess = document.getElementById('verify-success');

    const verifyCodeInput = document.getElementById('verify-code');
    const verifyEmailHidden = document.getElementById('verify-email-hidden');
    const resendBtn = document.getElementById('resend-verify-btn');

    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    const verifyCard = document.getElementById('verify-card');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginError.style.display = 'none';

            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                if (!response.ok) {
                    // Redirect unverified users to verify card
                    if (data.emailUnverified) {
                        if (verifyEmailHidden) verifyEmailHidden.value = data.email;
                        if (loginCard) loginCard.style.display = 'none';
                        if (signupCard) signupCard.style.display = 'none';
                        if (verifyCard) verifyCard.style.display = 'block';
                         if (verifyError) {
                            let errText = data.error;
                            if (data.devCode) {
                                errText += `<br><span style="color: var(--accent-gold); font-weight: bold;">[Dev Mode] SMTP not configured. Your code is: ${data.devCode}</span>`;
                            }
                            verifyError.innerHTML = errText;
                            verifyError.style.display = 'block';
                         }
                         if (verifySuccess) verifySuccess.style.display = 'none';
                        return;
                    }
                    throw new Error(data.error || 'Login failed.');
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'index.html';
            } catch (err) {
                loginError.textContent = err.message;
                loginError.style.display = 'block';
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            signupError.style.display = 'none';

            const email = document.getElementById('signup-email').value;
            const username = document.getElementById('signup-username').value;
            const password = document.getElementById('signup-password').value;

            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username, password })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Signup failed.');
                }

                // Redirect to verify code screen
                if (verifyEmailHidden) verifyEmailHidden.value = data.email;
                if (signupCard) signupCard.style.display = 'none';
                if (loginCard) loginCard.style.display = 'none';
                if (verifyCard) verifyCard.style.display = 'block';
                if (verifyError) verifyError.style.display = 'none';
                if (verifySuccess) {
                    let msg = 'Registration successful! A verification code has been sent to your email.';
                    if (data.devCode) {
                        msg += `<br><span style="color: var(--accent-gold); font-weight: bold;">[Dev Mode] SMTP not configured. Your code is: ${data.devCode}</span>`;
                    }
                    verifySuccess.innerHTML = msg;
                    verifySuccess.style.display = 'block';
                }
            } catch (err) {
                signupError.textContent = err.message;
                signupError.style.display = 'block';
            }
        });
    }

    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (verifyError) verifyError.style.display = 'none';
            if (verifySuccess) verifySuccess.style.display = 'none';

            const email = verifyEmailHidden.value;
            const code = verifyCodeInput.value.trim();

            try {
                const response = await fetch(`${API_BASE}/auth/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Verification failed.');
                }

                if (verifySuccess) {
                    verifySuccess.textContent = 'Account verified successfully! Redirecting...';
                    verifySuccess.style.display = 'block';
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);

            } catch (err) {
                if (verifyError) {
                    verifyError.textContent = err.message;
                    verifyError.style.display = 'block';
                }
            }
        });
    }

    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (verifyError) verifyError.style.display = 'none';
            if (verifySuccess) verifySuccess.style.display = 'none';

            const email = verifyEmailHidden.value;
            if (!email) {
                alert('Email address not found. Please try logging in again.');
                return;
            }

            try {
                resendBtn.textContent = 'Resending...';
                const response = await fetch(`${API_BASE}/auth/resend-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Resend code failed.');
                }

                if (verifySuccess) {
                    let msg = data.message || 'Verification code resent successfully!';
                    if (data.devCode) {
                        msg += `<br><span style="color: var(--accent-gold); font-weight: bold;">[Dev Mode] SMTP not configured. Your code is: ${data.devCode}</span>`;
                    }
                    verifySuccess.innerHTML = msg;
                    verifySuccess.style.display = 'block';
                }
            } catch (err) {
                if (verifyError) {
                    verifyError.textContent = err.message;
                    verifyError.style.display = 'block';
                }
            } finally {
                resendBtn.textContent = 'Resend Verification Code';
            }
        });
    }

    const verifyBackToLoginBtn = document.getElementById('verify-back-to-login-btn');
    if (verifyBackToLoginBtn) {
        verifyBackToLoginBtn.addEventListener('click', async () => {
            const email = verifyEmailHidden ? verifyEmailHidden.value : '';
            
            // Clear all input fields in signup form and verify form
            const signupEmailField = document.getElementById('signup-email');
            const signupUsernameField = document.getElementById('signup-username');
            const signupPasswordField = document.getElementById('signup-password');
            const verifyCodeField = document.getElementById('verify-code');

            if (signupEmailField) signupEmailField.value = '';
            if (signupUsernameField) signupUsernameField.value = '';
            if (signupPasswordField) signupPasswordField.value = '';
            if (verifyCodeField) verifyCodeField.value = '';

            // Clean error/success messages
            if (verifyError) verifyError.style.display = 'none';
            if (verifySuccess) verifySuccess.style.display = 'none';
            if (signupError) signupError.style.display = 'none';

            if (!email) return;

            try {
                // Cancel on backend (silently remove unverified user)
                await fetch(`${API_BASE}/auth/cancel-registration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
            } catch (err) {
                console.error('Failed to cancel registration:', err);
            }
        });
    }
}

// =============================================================
// CREATE POST LOGIC (Shared by Feed & Profile)
// =============================================================
let selectedPostImageBase64 = '';

function setupCreatePostModal() {
    const modal = document.getElementById('create-post-modal-overlay');
    const openBtn = document.getElementById('open-create-btn');
    const mobileOpenBtn = document.getElementById('mobile-open-create-btn');
    const closeBtn = document.getElementById('close-create-modal');
    const fileInput = document.getElementById('post-file-input');
    const urlInput = document.getElementById('post-url-input');
    const dropArea = document.getElementById('drop-area');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img-element');
    const removePreviewBtn = document.getElementById('remove-preview-btn');
    const captionArea = document.getElementById('caption-area');
    const submitBtn = document.getElementById('submit-post-btn');
    const captionInput = document.getElementById('post-caption-input');

    if (previewImg) {
        previewImg.onerror = () => {
            const currentSrc = previewImg.getAttribute('src');
            if (currentSrc && currentSrc !== '') {
                alert("Failed to load post image preview. Please make sure the URL is a direct link to an image (e.g. ending in .jpg, .png) and is publicly accessible.");
                resetModal();
            }
        };
    }

    if (!modal) return;

    function openModal() {
        modal.classList.add('active');
        resetModal();
    }

    function closeModal() {
        modal.classList.remove('active');
        resetModal();
    }

    function resetModal() {
        selectedPostImageBase64 = '';
        fileInput.value = '';
        urlInput.value = '';
        previewImg.src = '';
        captionInput.value = '';
        const moodSelect = document.getElementById('post-mood-select');
        if (moodSelect) moodSelect.value = '';
        const categorySelect = document.getElementById('post-category-select');
        if (categorySelect) categorySelect.value = 'General';
        const customWrapper = document.getElementById('post-custom-category-wrapper');
        const customInput = document.getElementById('post-custom-category-input');
        if (customWrapper) customWrapper.style.display = 'none';
        if (customInput) customInput.value = '';
        
        dropArea.style.display = 'flex';
        previewContainer.style.display = 'none';
        captionArea.style.display = 'none';
        submitBtn.style.display = 'none';
    }

    function handleImageSelected(base64Data) {
        selectedPostImageBase64 = base64Data;
        previewImg.src = base64Data;
        
        dropArea.style.display = 'none';
        previewContainer.style.display = 'block';
        captionArea.style.display = 'block';
        submitBtn.style.display = 'block';
    }

    // Category Select change handler for "Other" custom category input
    const categorySelect = document.getElementById('post-category-select');
    const customWrapper = document.getElementById('post-custom-category-wrapper');
    const customInput = document.getElementById('post-custom-category-input');

    if (categorySelect && customWrapper) {
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'Other') {
                customWrapper.style.display = 'flex';
                if (customInput) customInput.focus();
            } else {
                customWrapper.style.display = 'none';
            }
        });
    }

    // Event Listeners
    if (openBtn) openBtn.addEventListener('click', openModal);
    if (mobileOpenBtn) mobileOpenBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // File selection with client-side canvas compression
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file);
                handleImageSelected(compressedBase64);
            } catch (err) {
                alert('Error reading or compressing file. Please try again.');
            }
        }
    });

    // Paste / Load Image URL
    const urlSubmitBtn = document.getElementById('post-url-submit-btn');

    function loadUrlImage() {
        const url = urlInput.value.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
            handleImageSelected(url);
        } else {
            alert('Please enter a valid URL starting with http:// or https://');
        }
    }

    if (urlSubmitBtn) {
        urlSubmitBtn.addEventListener('click', loadUrlImage);
    }

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadUrlImage();
        }
    });

    urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
            handleImageSelected(url);
        }
    });

    // Remove Preview
    removePreviewBtn.addEventListener('click', () => {
        resetModal();
    });

    // Hook AI Caption Generator
    const aiBtn = document.getElementById('ai-generate-caption-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            const moodSelect = document.getElementById('post-mood-select');
            const selectedMood = moodSelect ? moodSelect.value : '';
            
            const mockCaptions = {
                '': [
                    "Living life in high resolution. 📸 #spotlite #lifestyle",
                    "Moments like these. ✨ #spotlite #vibes",
                    "Capturing memories one frame at a time. #memory #spotlite"
                ],
                'Happy': [
                    "Good vibes only! 😊 Smiling through it all. #happy #positive #goodvibes #spotlite",
                    "Find joy in the ordinary. ✨ #joyful #happiness #smile #spotlite",
                    "Happy mind, happy life. 🌟 #happy #spotlite #positivevibes"
                ],
                'Travel': [
                    "Wanderlust and city dust. ✈️ Exploring new horizons. #travel #adventure #explore #spotlite",
                    "Travel more, worry less. 🌍 #wanderlust #travelgram #spotlite #explorer",
                    "Collecting moments, not things. 🗺️ #traveling #scenic #spotlite"
                ],
                'Study': [
                    "Chasing dreams and deadlines. 📚 Knowledge is power. #study #learning #focused #spotlite",
                    "Deep work session in progress. 🧠 #studymode #motivation #spotlite #education",
                    "Success is the sum of small efforts. 📖 #studying #growth #spotlite"
                ],
                'Fitness': [
                    "No excuses, just results. 💪 Sweat today, shine tomorrow. #fitness #workout #healthy #spotlite",
                    "Push your limits. 🏃‍♂️💨 #fitlife #exercise #active #spotlite #gym",
                    "Consistency is key. 🏋️‍♀️ #health #gymmotivation #spotlite"
                ],
                'Coding': [
                    "Code runs, bugs cry. 💻 Refactoring the world one line at a time. #coding #developer #javascript #spotlite",
                    "Eat, Sleep, Code, Repeat. 🧠⚙️ #programming #softwareengineer #tech #spotlite",
                    "Configuring dreams into code. 🚀 #webdev #programmer #buildinpublic #spotlite"
                ]
            };
            
            const list = mockCaptions[selectedMood] || mockCaptions[''];
            const randomCaption = list[Math.floor(Math.random() * list.length)];
            captionInput.value = randomCaption;

            // Auto-select category if appropriate
            const categorySelect = document.getElementById('post-category-select');
            if (categorySelect) {
                if (selectedMood === 'Coding') categorySelect.value = 'Tech & Code';
                else if (selectedMood === 'Travel') categorySelect.value = 'Travel & Lifestyle';
                else if (selectedMood === 'Fitness') categorySelect.value = 'Fitness & Health';
                else if (selectedMood === 'Study') categorySelect.value = 'Education';
                else if (selectedMood === 'Happy') categorySelect.value = 'General';
            }
        });
    }

    // Submit / Share Post
    submitBtn.addEventListener('click', async () => {
        if (!selectedPostImageBase64) return;

        const caption = captionInput.value;
        const moodSelect = document.getElementById('post-mood-select');
        const mood = moodSelect ? moodSelect.value : '';
        const categorySelect = document.getElementById('post-category-select');
        let category = categorySelect ? categorySelect.value : '';

        if (category === 'Other') {
            const customInput = document.getElementById('post-custom-category-input');
            category = customInput ? customInput.value.trim() : '';
            if (!category) category = 'Other';
        } else if (!category) {
            category = 'General';
            const lowerCap = caption.toLowerCase();
            if (mood === 'Coding' || lowerCap.includes('code') || lowerCap.includes('tech') || lowerCap.includes('dev')) {
                category = 'Tech & Code';
            } else if (mood === 'Travel' || lowerCap.includes('travel') || lowerCap.includes('trip')) {
                category = 'Travel & Lifestyle';
            } else if (mood === 'Fitness' || lowerCap.includes('gym') || lowerCap.includes('workout')) {
                category = 'Fitness & Health';
            } else if (mood === 'Study' || lowerCap.includes('study') || lowerCap.includes('learn')) {
                category = 'Education';
            }
        }

        try {
            submitBtn.textContent = 'Sharing...';
            submitBtn.disabled = true;

            const response = await fetch(`${API_BASE}/posts`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    image: selectedPostImageBase64,
                    caption,
                    mood,
                    category
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create post');

            closeModal();
            // Refresh feed or user profile grid
            if (window.location.pathname.includes('profile.html')) {
                const params = new URLSearchParams(window.location.search);
                loadProfileGrid(params.get('u'));
            } else {
                loadFeedPosts();
            }
        } catch (err) {
            alert(err.message);
        } finally {
            submitBtn.textContent = 'Share';
            submitBtn.disabled = false;
        }
    });
}

// =============================================================
// MAIN FEED PAGE (index.html)
// =============================================================
async function initFeedPage() {
    if (!checkAuth()) return;
    
    await fetchSavedPostsSet();
    setupNavigationLinks();
    setupCreatePostModal();
    setupSearchPanel();
    setupSettingsModal();
    loadCurrentUserCard();
    setupMoodFilters();
    loadFeedPosts();
    loadSuggestions();
    loadStoriesBar();
}

// Load small top-right user card on the feed
function loadCurrentUserCard() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const avatar = document.getElementById('current-user-avatar');
    const username = document.getElementById('current-user-username');
    const bio = document.getElementById('current-user-bio');

    if (avatar) avatar.src = user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`;
    if (username) username.textContent = user.username;
    if (bio) bio.textContent = user.bio ? (user.bio.length > 30 ? user.bio.substring(0, 30) + '...' : user.bio) : 'Spotlite user';
}

// Generate a single skeleton post card HTML string
function skeletonPostCard() {
    return `
    <div class="skeleton-post-card">
        <div class="skeleton-post-header">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-post-meta">
                <div class="skeleton skeleton-line w-60"></div>
                <div class="skeleton skeleton-line w-40"></div>
            </div>
        </div>
        <div class="skeleton skeleton-post-image"></div>
        <div class="skeleton skeleton-line w-90"></div>
        <div class="skeleton skeleton-line w-70"></div>
        <div class="skeleton-post-actions">
            <div class="skeleton skeleton-action"></div>
            <div class="skeleton skeleton-action"></div>
            <div class="skeleton skeleton-action"></div>
        </div>
    </div>`;
}

let activeMoodFilter = 'all';

function setupMoodFilters() {
    const container = document.getElementById('feed-mood-filter-bar');
    if (!container) return;

    const btns = container.querySelectorAll('.mood-filter-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeMoodFilter = btn.dataset.mood;
            loadFeedPosts();
        };
    });
}

// Fetch and render posts stream
async function loadFeedPosts() {
    const postsStream = document.getElementById('posts-stream');
    if (!postsStream) return;

    // Show skeleton placeholders immediately
    postsStream.innerHTML = Array(4).fill(skeletonPostCard()).join('');

    try {
        let url = `${API_BASE}/posts`;
        if (activeCategoryFilter && activeCategoryFilter.toLowerCase() !== 'all') {
            url += `?category=${encodeURIComponent(activeCategoryFilter)}`;
        }

        const response = await fetch(url, {
            headers: getHeaders()
        });

        const posts = await response.json();
        if (!response.ok) throw new Error(posts.error || 'Failed to load posts');

        let filteredPosts = posts;

        if (filteredPosts.length === 0) {
            postsStream.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; border: 1px solid var(--border-color); border-radius: 12px; background-color: var(--bg-secondary); width: 100%;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--text-secondary)" stroke-width="1.5" fill="none" style="margin-bottom: 12px;"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3"/><path d="M19 5L17 5"/></svg>
                    <h3>No posts in category "${activeCategoryFilter}"</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 6px;">Try selecting another category or share a post under this category!</p>
                </div>
            `;
            return;
        }

        postsStream.innerHTML = '';
        filteredPosts.forEach(post => {
            const card = createPostCard(post);
            postsStream.appendChild(card);
        });
    } catch (err) {
        postsStream.innerHTML = `<div style="color: var(--accent-red); text-align: center; padding: 20px;">Error: ${err.message}</div>`;
    }
}

// Generate the HTML elements of a feed post card
function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.id = `post-${post._id}`;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isLiked = post.likes.includes(currentUser ? currentUser.id : '');
    const shareCount = post.shares ? post.shares.length : 0;

    // Caption truncation
    const caption = escapeHtml(post.caption || '');
    const CAPTION_LIMIT = 80;
    const captionShort = caption.length > CAPTION_LIMIT
        ? caption.substring(0, CAPTION_LIMIT) + '...'
        : caption;
    const hasTruncation = caption.length > CAPTION_LIMIT;

    card.innerHTML = `
        <!-- Post Header -->
        <div class="post-header">
            <div class="post-author-info" onclick="window.location.href='profile.html?u=${post.author.username}'">
                <div class="post-avatar-ring">
                    <img src="${post.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${post.author.username}`}" alt="Avatar" class="post-avatar">
                </div>
                <div class="post-header-meta">
                    <span class="post-username" style="display: inline-flex; align-items: center; gap: 6px;">
                        ${post.author.username}
                        ${getCategoryBadgeHTML(post.category)}
                        ${post.isPinned ? '<span class="pin-indicator" title="Pinned Post" style="margin-left: 4px; color: var(--accent-gold); font-size: 0.8rem;">📌</span>' : ''}
                    </span>
                    <span class="post-time-sub">${formatTime(post.createdAt)}</span>
                </div>
            </div>
            <button class="post-menu-btn" title="More options">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            </button>
        </div>

        <!-- Post Image -->
        <div class="post-image-container">
            <img src="${post.image}" alt="Post image" class="post-image">
            <span class="like-heart-pop">❤️</span>
        </div>

        <!-- Dot indicator -->
        <div class="post-dots-row">
            <span class="post-dot post-dot--active"></span>
        </div>

        <!-- Action Bar -->
        <div class="post-actions">
            <div class="post-actions-left">
                <!-- Like -->
                <button class="action-btn ${isLiked ? 'liked' : ''}" id="like-btn-${post._id}" title="Like">
                    <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <span class="action-count" id="likes-count-${post._id}">${post.likes.length}</span>
                </button>
                <!-- Comment -->
                <button class="action-btn" id="comment-btn-${post._id}" title="Comment">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="action-count">${post.comments.length}</span>
                </button>
                <!-- Repost -->
                <button class="action-btn" id="repost-btn-${post._id}" title="Repost">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    <span class="action-count" id="repost-count-${post._id}">${shareCount}</span>
                </button>
                <!-- Share/Send -->
                <button class="action-btn share-trigger-btn" data-post-id="${post._id}" title="Share">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
            </div>
            <!-- Bookmark -->
            <button class="action-btn bookmark-btn ${window.savedPostIdsSet && window.savedPostIdsSet.has(post._id) ? 'bookmarked' : ''}" id="bookmark-btn-${post._id}" title="Save">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
        </div>

        <!-- Caption & Comments -->
        <div class="post-caption-wrapper">
            ${post.mood ? `<span class="post-mood-tag">${post.mood}</span>` : ''}
            <span class="caption-username" onclick="window.location.href='profile.html?u=${post.author.username}'">${post.author.username}</span>
            <span class="caption-text" id="caption-text-${post._id}">${captionShort}</span>
            ${hasTruncation ? `<button class="caption-more-btn" data-full="${encodeURIComponent(caption)}" data-post="${post._id}">more</button>` : ''}
        </div>

        ${post.comments.length > 0 ? `
        <button class="comments-preview-btn" onclick="openPostDetailModal('${post._id}')">View all ${post.comments.length} comment${post.comments.length !== 1 ? 's' : ''}</button>
        ` : ''}

        <div class="comment-input-wrapper">
            <img src="${currentUser ? (currentUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser.username}`) : 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=default'}" class="comment-input-avatar" alt="">
            <input type="text" class="comment-input" id="comment-input-${post._id}" placeholder="Add a comment...">
            <button class="comment-submit-btn" id="comment-submit-${post._id}">Post</button>
        </div>
    `;

    // Hook events
    const imageContainer = card.querySelector('.post-image-container');
    const likeBtn = card.querySelector(`#like-btn-${post._id}`);
    const likesCount = card.querySelector(`#likes-count-${post._id}`);
    const commentBtn = card.querySelector(`#comment-btn-${post._id}`);
    const commentInput = card.querySelector(`#comment-input-${post._id}`);
    const commentSubmit = card.querySelector(`#comment-submit-${post._id}`);
    const heartPop = card.querySelector('.like-heart-pop');
    const shareBtn = card.querySelector('.share-trigger-btn');
    const bookmarkBtn = card.querySelector(`#bookmark-btn-${post._id}`);

    // Caption "more" toggle
    const moreBtn = card.querySelector('.caption-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            card.querySelector(`#caption-text-${post._id}`).textContent = decodeURIComponent(moreBtn.dataset.full);
            moreBtn.remove();
        });
    }

    // Like Toggle
    async function toggleLike() {
        try {
            const response = await fetch(`${API_BASE}/posts/${post._id}/like`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            likeBtn.classList.toggle('liked', data.liked);
            likesCount.textContent = data.likesCount;
        } catch (err) {
            console.error('Like error:', err);
        }
    }

    // Double tap to like, single tap to view
    let lastTap = 0, clickTimeout;
    imageContainer.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            clearTimeout(clickTimeout);
            heartPop.classList.add('animate-heart');
            setTimeout(() => heartPop.classList.remove('animate-heart'), 800);
            if (!likeBtn.classList.contains('liked')) toggleLike();
        } else {
            clickTimeout = setTimeout(() => openPostDetailModal(post._id), 300);
        }
        lastTap = now;
    });

    likeBtn.addEventListener('click', toggleLike);

    // Comment button opens detail modal to view/add comments
    commentBtn.addEventListener('click', () => openPostDetailModal(post._id));

    // Bookmark toggle
    bookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(`${API_BASE}/posts/${post._id}/save`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            bookmarkBtn.classList.toggle('bookmarked', data.saved);
            if (data.saved) {
                if (window.savedPostIdsSet) window.savedPostIdsSet.add(post._id);
            } else {
                if (window.savedPostIdsSet) window.savedPostIdsSet.delete(post._id);
                // If we are on the profile page and the active tab is "Saved", remove the card immediately
                const activeTab = document.querySelector('.profile-tab.active');
                if (activeTab && activeTab.id === 'tab-saved-btn') {
                    card.remove();
                }
            }
        } catch (err) {
            console.error('Save post error:', err);
        }
    });

    // Share button
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openShareModal(post._id, post);
    });

    // Options Menu Button (Three-dots)
    const menuBtn = card.querySelector('.post-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuOptions = [];
            
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const isOwner = currentUser && post.author && (post.author._id || post.author) === currentUser.id;
            const isAdmin = currentUser && currentUser.isAdmin;

            if (isOwner || isAdmin) {
                if (isOwner) {
                    menuOptions.push({
                        label: post.isPinned ? 'Unpin Post' : 'Pin Post',
                        onClick: async () => {
                            try {
                                const res = await fetch(`${API_BASE}/posts/${post._id}/pin`, {
                                    method: 'POST',
                                    headers: getHeaders()
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error);

                                alert(data.isPinned ? 'Post pinned successfully!' : 'Post unpinned successfully!');
                                if (window.location.pathname.includes('profile.html')) {
                                    const params = new URLSearchParams(window.location.search);
                                    loadProfileGrid(params.get('u'));
                                } else {
                                    loadFeedPosts();
                                }
                            } catch (e) {
                                alert(e.message);
                            }
                        }
                    });

                    menuOptions.push({
                        label: 'Edit Post',
                        onClick: () => {
                            showPromptModal('Edit Caption', post.caption || '', async (newCaption) => {
                                try {
                                    const res = await fetch(`${API_BASE}/posts/${post._id}`, {
                                        method: 'PUT',
                                        headers: getHeaders(),
                                        body: JSON.stringify({ caption: newCaption })
                                    });
                                    const updatedPost = await res.json();
                                    if (!res.ok) throw new Error(updatedPost.error);
                                    
                                    const captionTextEl = card.querySelector(`#caption-text-${post._id}`);
                                    if (captionTextEl) captionTextEl.textContent = newCaption;
                                    post.caption = newCaption;
                                } catch (err) {
                                    alert(err.message);
                                }
                            });
                        }
                    });
                }

                menuOptions.push({
                    label: 'Delete Post',
                    danger: true,
                    onClick: () => {
                        if (confirm('Are you sure you want to delete this post?')) {
                            (async () => {
                                try {
                                    const res = await fetch(`${API_BASE}/posts/${post._id}`, {
                                        method: 'DELETE',
                                        headers: getHeaders()
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    
                                    card.remove();
                                } catch (err) {
                                    alert(err.message);
                                }
                            })();
                        }
                    }
                });
            } else {
                menuOptions.push({
                    label: 'Copy Profile Link',
                    onClick: () => {
                        navigator.clipboard.writeText(`${window.location.origin}/profile.html?u=${post.author.username}`);
                        alert('Profile link copied to clipboard!');
                    }
                });
            }

            showActionMenu(menuOptions);
        });
    }

    // Comment submit
    commentInput.addEventListener('input', () => {
        commentSubmit.classList.toggle('active', commentInput.value.trim() !== '');
    });

    commentSubmit.addEventListener('click', async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        try {
            const response = await fetch(`${API_BASE}/posts/${post._id}/comment`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ text })
            });
            const newComment = await response.json();
            if (!response.ok) throw new Error(newComment.error);

            commentInput.value = '';
            commentSubmit.classList.remove('active');

            // Update comment count
            const countEl = card.querySelector(`#comment-btn-${post._id} .action-count`);
            let newCount = 1;
            if (countEl) {
                newCount = parseInt(countEl.textContent || 0) + 1;
                countEl.textContent = newCount;
            }

            // Update or create "View all comments" button dynamically
            let previewBtn = card.querySelector('.comments-preview-btn');
            if (previewBtn) {
                previewBtn.textContent = `View all ${newCount} comment${newCount !== 1 ? 's' : ''}`;
            } else {
                const wrapper = card.querySelector('.comment-input-wrapper');
                if (wrapper) {
                    previewBtn = document.createElement('button');
                    previewBtn.className = 'comments-preview-btn';
                    previewBtn.onclick = () => openPostDetailModal(post._id);
                    previewBtn.textContent = `View all ${newCount} comment${newCount !== 1 ? 's' : ''}`;
                    wrapper.parentNode.insertBefore(previewBtn, wrapper);
                }
            }
        } catch (err) {
            alert(err.message);
        }
    });

    return card;
}

// =============================================================
// SHARE MODAL  (simple & clean)
// =============================================================
let _shareAllUsers  = [];   // all users loaded once per modal open
let _shareSelected  = new Set();
let _shareCurrentPostId = null;
let _shareCurrentPost   = null;

async function openShareModal(postId, post) {
    _shareCurrentPostId = postId;
    _shareCurrentPost   = post;
    _shareSelected.clear();

    const overlay = document.getElementById('share-modal-overlay');
    const list    = document.getElementById('share-users-list');
    const sendBtn = document.getElementById('share-send-btn');
    const search  = document.getElementById('share-search-input');
    if (!overlay) return;

    // Reset UI
    overlay.classList.add('active');
    search.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = 'Send';
    list.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">Loading...</p>';

    // Fetch ALL users (new endpoint - no follow filter, no limit)
    try {
        const res  = await fetch(`${API_BASE}/users/all`, { headers: getHeaders() });
        const data = await res.json();
        _shareAllUsers = Array.isArray(data) ? data : [];
    } catch (err) {
        list.innerHTML = '<p style="color:var(--accent-red);padding:20px;text-align:center">Could not load users</p>';
        return;
    }

    renderShareUsers('');

    // Search filter
    search.oninput = () => renderShareUsers(search.value.trim().toLowerCase());

    // Send to selected users
    sendBtn.onclick = sendShare;
}

async function sendShare() {
    if (!_shareSelected.size) return;
    const sendBtn = document.getElementById('share-send-btn');
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    const msg = _shareCurrentPost
        ? `📸 Check out this post!\n${_shareCurrentPost.caption || ''}`
        : '📸 Check out this post!';

    // Send DMs to selected users
    for (const uid of _shareSelected) {
        const user = _shareAllUsers.find(u => u._id === uid);
        if (!user) continue;
        try {
            await fetch(`${API_BASE}/messages`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ 
                    receiverId: uid, 
                    text: msg,
                    sharedPostId: _shareCurrentPostId
                })
            });
        } catch (e) { /* ignore individual failures */ }
    }

    // Now, also increment the share count on the backend.
    // This makes the "repost" count reflect shares via DM.
    try {
        const shareResponse = await fetch(`${API_BASE}/posts/${_shareCurrentPostId}/share`, {
            method: 'POST',
            headers: getHeaders()
        });
        const shareData = await shareResponse.json();
        if (shareResponse.ok) {
            const countEl = document.querySelector(`#repost-count-${_shareCurrentPostId}`);
            if (countEl) countEl.textContent = shareData.sharesCount;
        }
    } catch (err) {
        console.error('Failed to update share count', err);
    }

    sendBtn.textContent = 'Sent ✓';
    setTimeout(closeShareModal, 800);
}

function closeShareModal() {
    const overlay = document.getElementById('share-modal-overlay');
    const sendBtn = document.getElementById('share-send-btn');
    if (overlay) overlay.classList.remove('active');
    if (sendBtn) { sendBtn.textContent = 'Send'; sendBtn.disabled = true; }
    _shareSelected.clear();
    _shareCurrentPostId = null;
    _shareCurrentPost   = null;
}

// Render users into the share modal list, filtered by search query
function renderShareUsers(query) {
    const list = document.getElementById('share-users-list');
    const sendBtn = document.getElementById('share-send-btn');
    if (!list) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const filtered = _shareAllUsers.filter(u => {
        if (currentUser && u._id === currentUser.id) return false; // hide self
        return !query || u.username.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">No users found</p>';
        return;
    }

    list.innerHTML = '';
    filtered.forEach(user => {
        const isSelected = _shareSelected.has(user._id);
        const row = document.createElement('div');
        row.className = `share-user-row${isSelected ? ' selected' : ''}`;
        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background 0.2s;border-radius:8px;';
        row.innerHTML = `
            <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}"
                 style="width:42px;height:42px;border-radius:50%;object-fit:cover;" alt="">
            <span style="flex:1;font-weight:500;color:var(--text-primary)">${user.username}</span>
            <div style="
                width:22px;height:22px;border-radius:50%;
                border:2px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-color)'};
                background:${isSelected ? 'var(--accent-gold)' : 'transparent'};
                display:flex;align-items:center;justify-content:center;
                transition:all 0.2s;
            ">
                ${isSelected ? '<svg viewBox="0 0 24 24" width="13" height="13" stroke="#000" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
        `;
        row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-secondary)');
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        row.addEventListener('click', () => {
            if (_shareSelected.has(user._id)) {
                _shareSelected.delete(user._id);
            } else {
                _shareSelected.add(user._id);
            }
            sendBtn.disabled = _shareSelected.size === 0;
            sendBtn.textContent = _shareSelected.size > 0 ? `Send (${_shareSelected.size})` : 'Send';
            renderShareUsers(document.getElementById('share-search-input')?.value.trim().toLowerCase() || '');
        });
        list.appendChild(row);
    });
}

// Wire close buttons (once, on page load)
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('share-modal-overlay');
    const closeBtn = document.getElementById('share-modal-close');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeShareModal(); });
    if (closeBtn) closeBtn.addEventListener('click', closeShareModal);
});



// Load recommended suggestions
async function loadSuggestions() {
    const container = document.getElementById('suggestions-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getHeaders()
        });

        const users = await response.json();
        if (!response.ok) throw new Error(users.error);

        if (users.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No suggestions available</p>`;
            return;
        }

        container.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            row.innerHTML = `
                <div class="user-profile-card">
                    <div class="user-card-info" onclick="window.location.href='profile.html?u=${user.username}'">
                        <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="Avatar" class="user-card-avatar" style="width: 36px; height: 36px;">
                        <div class="user-card-names">
                            <span class="user-card-username" style="font-size: 0.88rem;">${user.username}</span>
                            <span class="user-card-fullname" style="font-size: 0.78rem;">Suggested for you</span>
                        </div>
                    </div>
                </div>
                <button class="follow-btn" id="suggest-follow-${user._id}">Follow</button>
            `;

            container.appendChild(row);

            // Hook follow toggle
            const followBtn = row.querySelector(`#suggest-follow-${user._id}`);
            followBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${API_BASE}/users/${user._id}/follow`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.error);

                    if (d.following) {
                        followBtn.textContent = 'Following';
                        followBtn.style.color = 'var(--text-secondary)';
                    } else {
                        followBtn.textContent = 'Follow';
                        followBtn.style.color = 'var(--accent-blue)';
                    }
                } catch (err) {
                    console.error('Follow error:', err);
                }
            });
        });
    } catch (err) {
        console.error('Failed to load suggestions:', err);
    }
}

// Load real users into stories bar
async function loadStoriesBar() {
    const container = document.getElementById('stories-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
        const users = await response.json();
        if (!response.ok || !users.length) {
            container.style.display = 'none';
            return;
        }

        // Always show the logged-in user's own story bubble first
        const currentUser = JSON.parse(localStorage.getItem('user'));
        container.innerHTML = '';

        if (currentUser) {
            const myBubble = document.createElement('div');
            myBubble.className = 'story-item';
            myBubble.onclick = () => window.location.href = `profile.html?u=${currentUser.username}`;
            myBubble.innerHTML = `
                <div class="story-avatar-wrapper story-avatar-wrapper--own">
                    <img src="${currentUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser.username}`}" alt="Your story" class="story-avatar">
                </div>
                <span class="story-username">You</span>
            `;
            container.appendChild(myBubble);
        }

        // Add other real users (exclude self)
        users
            .filter(u => !currentUser || u.username !== currentUser.username)
            .slice(0, 10)
            .forEach(user => {
                const item = document.createElement('div');
                item.className = 'story-item';
                item.onclick = () => window.location.href = `profile.html?u=${user.username}`;
                item.innerHTML = `
                    <div class="story-avatar-wrapper">
                        <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="${user.username}" class="story-avatar">
                    </div>
                    <span class="story-username">${user.username}</span>
                `;
                container.appendChild(item);
            });

        if (container.children.length === 0) container.style.display = 'none';
    } catch (err) {
        console.error('Stories bar error:', err);
        container.style.display = 'none';
    }
}

// =============================================================
// USER PROFILE PAGE (profile.html)
// =============================================================
let profileUserObjectId = ''; // Stores target profile ID for follow actions

async function initProfilePage() {
    if (!checkAuth()) return;

    await fetchSavedPostsSet();
    setupNavigationLinks();
    setupCreatePostModal();
    setupEditProfileModal();
    setupSearchPanel();
    setupSettingsModal();
    
    // Parse query param ?u=username
    const params = new URLSearchParams(window.location.search);
    const usernameParam = params.get('u');

    if (!usernameParam) {
        // Fallback to me
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
            window.location.href = `profile.html?u=${currentUser.username}`;
        }
        return;
    }

    await loadProfileHeader(usernameParam);
    setupProfileCategoryControls(usernameParam);
    await loadProfileGrid(usernameParam);
}

let activeProfileCategoryFilter = 'all';
let activeProfileViewMode = 'grid';

function setupProfileCategoryControls(username) {
    const filterBar = document.getElementById('profile-category-filter-bar');
    if (filterBar) {
        const pills = filterBar.querySelectorAll('.prof-cat-pill');
        pills.forEach(pill => {
            pill.onclick = () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeProfileCategoryFilter = pill.dataset.category || 'all';
                loadProfileGrid(username);
            };
        });
    }

    const gridBtn = document.getElementById('view-mode-grid');
    const listBtn = document.getElementById('view-mode-list');
    const grid = document.getElementById('profile-posts-grid');

    if (gridBtn && listBtn && grid) {
        gridBtn.onclick = () => {
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
            activeProfileViewMode = 'grid';
            grid.classList.remove('list-view');
            loadProfileGrid(username);
        };

        listBtn.onclick = () => {
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
            activeProfileViewMode = 'list';
            grid.classList.add('list-view');
            loadProfileGrid(username);
        };
    }
}

let currentProfileUser = null; // Stores currently loaded profile data

// Helper: Animate count-up of numbers
function animateNumber(elementId, targetNumber) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const duration = 800; // ms
    const startTime = performance.now();
    const startValue = 0;
    
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing: outQuad
        const eased = progress * (2 - progress);
        const currentValue = Math.floor(startValue + eased * (targetNumber - startValue));
        el.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = targetNumber;
        }
    }
    
    requestAnimationFrame(update);
}

// Helper: Render profile badges next to username
function renderProfileBadges(user) {
    const container = document.getElementById('profile-badges-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Admin badge
    if (user.isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'profile-badge admin';
        badge.textContent = 'Admin';
        container.appendChild(badge);
    }
    
    // Developer badge (either explicit user.badge == 'developer' or user has techStack items)
    if (user.badge === 'developer' || (user.techStack && user.techStack.length > 0)) {
        const badge = document.createElement('span');
        badge.className = 'profile-badge developer';
        badge.textContent = 'Developer';
        container.appendChild(badge);
    } else if (user.badge) {
        const badge = document.createElement('span');
        badge.className = 'profile-badge creator';
        badge.textContent = user.badge;
        container.appendChild(badge);
    }
}

// Helper: Setup profile tabs
function setupProfileTabs() {
    const btnPosts = document.getElementById('tab-posts-btn');
    const btnDev = document.getElementById('tab-dev-info-btn');
    const btnQA = document.getElementById('tab-qa-btn');
    const btnSaved = document.getElementById('tab-saved-btn');

    const panelPosts = document.getElementById('profile-posts-grid');
    const panelDev = document.getElementById('profile-dev-container');
    const panelQA = document.getElementById('profile-qa-container');
    const panelSaved = document.getElementById('profile-saved-grid');

    if (!btnPosts) return;

    function switchTab(activeBtn, activePanel) {
        [btnPosts, btnDev, btnQA, btnSaved].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        [panelPosts, panelDev, panelQA, panelSaved].forEach(panel => {
            if (panel) panel.style.display = 'none';
        });

        activeBtn.classList.add('active');
        activePanel.style.display = (activePanel === panelPosts || activePanel === panelSaved) ? 'grid' : 'block';
    }

    btnPosts.onclick = () => switchTab(btnPosts, panelPosts);
    
    btnDev.onclick = () => {
        switchTab(btnDev, panelDev);
        const githubWrapper = document.getElementById('dev-github-link-wrapper');
        const githubLink = document.getElementById('profile-github-link');
        const techStackContainer = document.getElementById('profile-tech-stack');

        if (currentProfileUser) {
            if (currentProfileUser.githubUrl) {
                githubLink.href = currentProfileUser.githubUrl;
                githubWrapper.style.display = 'block';
            } else {
                githubWrapper.style.display = 'none';
            }

            techStackContainer.innerHTML = '';
            if (currentProfileUser.techStack && currentProfileUser.techStack.length > 0) {
                currentProfileUser.techStack.forEach(tech => {
                    const tag = document.createElement('span');
                    tag.className = 'tech-tag';
                    tag.textContent = tech;
                    techStackContainer.appendChild(tag);
                });
            } else {
                techStackContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No tech stack skills configured yet.</p>';
            }
        }
    };
    
    btnQA.onclick = () => {
        switchTab(btnQA, panelQA);
        loadQA(profileUserObjectId);
        setupQASubmission(profileUserObjectId);
    };

    if (btnSaved) {
        btnSaved.onclick = () => {
            switchTab(btnSaved, panelSaved);
            loadSavedProfileGrid();
        };
    }
}

// Helper: Load Saved posts grid
async function loadSavedProfileGrid() {
    const grid = document.getElementById('profile-saved-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 20px;">Loading saved posts...</p>';

    try {
        const response = await fetch(`${API_BASE}/posts/saved`, {
            headers: getHeaders()
        });

        const posts = await response.json();
        if (!response.ok) throw new Error(posts.error);

        if (posts.length === 0) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 0; border-top: 1px solid var(--border-color); grid-column: 1/-1; width: 100%;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--text-secondary)" stroke-width="1.5" fill="none" style="margin-bottom: 12px;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    <h3>No Saved Posts</h3>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'grid-post-item';
            item.innerHTML = `
                <img src="${post.image}" alt="Post image" class="grid-post-img">
                <div class="grid-post-overlay">
                    <div class="overlay-stat">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${post.likes ? post.likes.length : 0}</span>
                    </div>
                    <div class="overlay-stat">
                        <svg viewBox="0 0 24 24" stroke="white" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>${post.comments ? post.comments.length : 0}</span>
                    </div>
                </div>
            `;

            item.addEventListener('click', () => {
                openPostDetailModal(post._id);
            });

            grid.appendChild(item);
        });
    } catch (err) {
        console.error('Error fetching saved grid posts:', err);
        grid.innerHTML = '<p style="color:var(--accent-red); grid-column: 1/-1; text-align: center; padding: 20px;">Failed to load saved posts.</p>';
    }
}

// Helper: Load Anonymous QA questions list
async function loadQA(userId) {
    const list = document.getElementById('profile-qa-list');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--text-secondary)">Loading Q&A...</p>';

    try {
        const response = await fetch(`${API_BASE}/qa/${userId}`, {
            headers: getHeaders()
        });
        const questions = await response.json();
        if (!response.ok) throw new Error(questions.error);

        if (questions.length === 0) {
            list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px 0;">No questions yet.</p>`;
            return;
        }

        list.innerHTML = '';
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isOwner = currentUser && currentUser.id === userId;

        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'qa-card';
            
            let answerHtml = '';
            if (q.isAnswered) {
                answerHtml = `
                    <div class="qa-answer-box">
                        <span class="qa-answer-label">Answer</span>
                        ${escapeHtml(q.answer)}
                    </div>
                `;
            } else if (isOwner) {
                answerHtml = `
                    <div class="qa-answer-input-wrapper">
                        <input type="text" class="qa-answer-input" id="answer-input-${q._id}" placeholder="Type your answer...">
                        <button class="qa-answer-btn" id="answer-btn-${q._id}">Reply</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="qa-question-text">
                    ${escapeHtml(q.text)}
                </div>
                ${answerHtml}
            `;

            list.appendChild(card);

            if (!q.isAnswered && isOwner) {
                const answerBtn = card.querySelector(`#answer-btn-${q._id}`);
                const answerInput = card.querySelector(`#answer-input-${q._id}`);
                answerBtn.onclick = async () => {
                    const answerText = answerInput.value.trim();
                    if (!answerText) return;
                    try {
                        answerBtn.textContent = '...';
                        const res = await fetch(`${API_BASE}/qa/answer/${q._id}`, {
                            method: 'POST',
                            headers: getHeaders(),
                            body: JSON.stringify({ answer: answerText })
                        });
                        const resData = await res.json();
                        if (!res.ok) throw new Error(resData.error);

                        loadQA(userId);
                    } catch (e) {
                        alert(e.message);
                        answerBtn.textContent = 'Reply';
                    }
                };
            }
        });
    } catch (err) {
        console.error('QA load error:', err);
        list.innerHTML = '<p style="color:var(--accent-red)">Error loading Q&A.</p>';
    }
}

// Helper: Setup QA Submission for guests
function setupQASubmission(userId) {
    const askBox = document.getElementById('qa-ask-box-wrapper');
    const submitBtn = document.getElementById('qa-submit-question-btn');
    const input = document.getElementById('qa-question-input');
    if (!submitBtn || !input) return;

    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser && currentUser.id === userId) {
        if (askBox) askBox.style.display = 'none';
        return;
    } else {
        if (askBox) askBox.style.display = 'flex';
    }

    submitBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            const res = await fetch(`${API_BASE}/qa/ask/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error);

            input.value = '';
            alert('Your anonymous question has been sent successfully!');
            loadQA(userId);
        } catch (e) {
            alert(e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ask Anonymously';
        }
    };
}

// Loads profile header details
async function loadProfileHeader(username) {
    try {
        const response = await fetch(`${API_BASE}/users/profile/${username}`, {
            headers: getHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Profile not found.');

        profileUserObjectId = data.id;
        currentProfileUser = data;
        applyThemeClass(data.profileTheme);

        // Populate elements
        document.getElementById('profile-user-avatar').src = data.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${data.username}`;
        document.getElementById('profile-username-heading').textContent = data.username;
        document.getElementById('profile-fullname').textContent = data.username;
        document.getElementById('profile-bio-text').textContent = data.bio || 'No bio description.';

        // Animate stats
        animateNumber('profile-followers-count', data.followersCount);
        animateNumber('profile-following-count', data.followingCount);

        // Render badges
        renderProfileBadges(data);

        // Bio link
        const bioLinkWrapper = document.getElementById('profile-bio-link-wrapper');
        const bioLinkEl = document.getElementById('profile-bio-link');
        if (bioLinkWrapper && bioLinkEl) {
            if (data.bioLink) {
                let displayLink = data.bioLink;
                if (displayLink.startsWith('http://')) displayLink = displayLink.substring(7);
                if (displayLink.startsWith('https://')) displayLink = displayLink.substring(8);
                if (displayLink.length > 30) displayLink = displayLink.substring(0, 30) + '...';
                
                let href = data.bioLink;
                if (!href.startsWith('http://') && !href.startsWith('https://')) {
                    href = 'https://' + href;
                }
                
                bioLinkEl.href = href;
                bioLinkEl.textContent = displayLink;
                bioLinkWrapper.style.display = 'block';
            } else {
                bioLinkWrapper.style.display = 'none';
            }
        }

        setupProfileTabs();

        // Determine if it is my profile or someone else's
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const editBtn      = document.getElementById('open-edit-profile-btn');
        const optionsBtn   = document.getElementById('profile-options-btn');
        const actionsRow   = document.getElementById('profile-actions-row');
        const followBtn    = document.getElementById('profile-follow-btn');
        const followLabel  = document.getElementById('profile-follow-label');
        const followChevron = document.getElementById('follow-chevron');
        const messageBtn   = document.getElementById('profile-message-btn');
        const addBtn       = document.getElementById('profile-add-btn');

        // Setup followers / following popup handlers
        const followListOverlay = document.getElementById('follow-list-modal-overlay');
        const followListTitle = document.getElementById('follow-list-title');
        const followListContainer = document.getElementById('follow-list-container');
        const closeFollowListModal = document.getElementById('close-follow-list-modal');

        function openFollowModal(type, usersList) {
            if (!followListOverlay) return;
            followListTitle.textContent = type === 'followers' ? 'Followers' : 'Following';
            followListContainer.innerHTML = '';

            if (!usersList || usersList.length === 0) {
                followListContainer.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">No ${type} yet.</p>`;
            } else {
                usersList.forEach(user => {
                    const row = document.createElement('div');
                    row.className = 'follow-user-row';
                    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--border-color);';
                    row.innerHTML = `
                        <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}"
                             style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="">
                        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
                            <span style="font-weight:600;color:var(--text-primary);font-size:0.88rem;">${user.username}</span>
                            ${user.bio ? `<span style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">${escapeHtml(user.bio)}</span>` : ''}
                        </div>
                    `;
                    row.onclick = () => {
                        followListOverlay.classList.remove('active');
                        window.location.href = `profile.html?u=${user.username}`;
                    };
                    followListContainer.appendChild(row);
                });
            }

            followListOverlay.classList.add('active');
        }

        const followersBtn = document.getElementById('view-followers-btn');
        const followingBtn = document.getElementById('view-following-btn');

        if (followersBtn) {
            followersBtn.onclick = () => openFollowModal('followers', data.followers);
        }
        if (followingBtn) {
            followingBtn.onclick = () => openFollowModal('following', data.following);
        }

        if (closeFollowListModal) {
            closeFollowListModal.onclick = () => {
                followListOverlay.classList.remove('active');
            };
        }
        if (followListOverlay) {
            followListOverlay.onclick = (e) => {
                if (e.target === followListOverlay) {
                    followListOverlay.classList.remove('active');
                }
            };
        }

        // Setup Admin action row visibility and trigger
        const adminActionsRow = document.getElementById('admin-actions-row');
        const adminDeleteBtn = document.getElementById('admin-delete-user-btn');

        if (adminActionsRow && adminDeleteBtn) {
            const isAdmin = currentUser && currentUser.isAdmin;
            const isOwnProfile = currentUser && currentUser.username === username.toLowerCase();

            if (isAdmin && !isOwnProfile) {
                adminActionsRow.style.display = 'block';
                adminDeleteBtn.onclick = async () => {
                    if (confirm(`ADMIN WARNING: Are you sure you want to delete the user account "${data.username}" and all of their posts? This action CANNOT be undone.`)) {
                        try {
                            const res = await fetch(`${API_BASE}/users/${data.id}`, {
                                method: 'DELETE',
                                headers: getHeaders()
                            });
                            const resData = await res.json();
                            if (!res.ok) throw new Error(resData.error);

                            alert('User account deleted successfully!');
                            window.location.href = 'index.html';
                        } catch (err) {
                            alert(err.message);
                        }
                    }
                };
            } else {
                adminActionsRow.style.display = 'none';
            }
        }

        const tabSavedBtn = document.getElementById('tab-saved-btn');
        if (currentUser && currentUser.username === username.toLowerCase()) {
            // OWN profile – show edit button only
            editBtn.style.display = 'block';
            optionsBtn.style.display = 'none';
            actionsRow.style.display = 'none';
            if (tabSavedBtn) tabSavedBtn.style.display = 'flex';
        } else {
            // OTHER profile – show actions row & options
            editBtn.style.display = 'none';
            optionsBtn.style.display = 'flex';
            actionsRow.style.display = 'flex';
            if (tabSavedBtn) tabSavedBtn.style.display = 'none';

            // Check if currently following
            const isFollowing = data.followers && data.followers.some(f => (f._id || f) === (currentUser ? currentUser.id : ''));

            function setFollowState(following) {
                if (following) {
                    followLabel.textContent = 'Following';
                    followChevron.style.display = 'inline';
                    followBtn.classList.add('following');
                } else {
                    followLabel.textContent = 'Follow';
                    followChevron.style.display = 'none';
                    followBtn.classList.remove('following');
                }
            }

            setFollowState(isFollowing);

            // Follow / Unfollow toggle
            followBtn.onclick = async () => {
                try {
                    const res = await fetch(`${API_BASE}/users/${data.id}/follow`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const resData = await res.json();
                    if (!res.ok) throw new Error(resData.error);

                    setFollowState(resData.following);
                    document.getElementById('profile-followers-count').textContent = resData.followersCount;
                } catch (err) {
                    alert(err.message);
                }
            };

            // Message button → open DM thread
            messageBtn.onclick = () => {
                window.location.href = `messages.html?u=${encodeURIComponent(data.username)}`;
            };

            // Add / Suggest (no-op for now, can be wired later)
            addBtn.onclick = () => {
                addBtn.style.color = 'var(--accent-gold)';
                addBtn.style.borderColor = 'var(--accent-gold)';
            };
        }
    } catch (err) {
        document.querySelector('.main-content').innerHTML = `
            <div style="text-align:center; padding: 100px 20px;">
                <h2>User not found</h2>
                <p style="color: var(--text-secondary); margin-top: 10px;">The link you followed may be broken, or the page may have been removed.</p>
                <a href="index.html" style="color: var(--accent-blue); font-weight:600; margin-top: 20px; display:inline-block;">Go back to Spotlite</a>
            </div>
        `;
    }
}


// Load grids of posts for user profile
async function loadProfileGrid(username) {
    if (!username) {
        const params = new URLSearchParams(window.location.search);
        username = params.get('u');
    }

    const grid = document.getElementById('profile-posts-grid');
    if (!grid) return;

    try {
        let url = `${API_BASE}/posts/user/${username}`;
        if (activeProfileCategoryFilter && activeProfileCategoryFilter.toLowerCase() !== 'all') {
            url += `?category=${encodeURIComponent(activeProfileCategoryFilter)}`;
        }

        const response = await fetch(url, {
            headers: getHeaders()
        });

        const posts = await response.json();
        if (!response.ok) throw new Error(posts.error);

        document.getElementById('profile-post-count').textContent = posts.length;

        if (posts.length === 0) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 0; border-top: 1px solid var(--border-color); width: 100%; grid-column: 1/-1;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--text-secondary)" stroke-width="1.5" fill="none" style="margin-bottom: 12px;"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3"/><path d="M19 5L17 5"/></svg>
                    <h3>No Posts ${activeProfileCategoryFilter !== 'all' ? `in category "${activeProfileCategoryFilter}"` : 'Yet'}</h3>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        if (activeProfileViewMode === 'list') {
            grid.classList.add('list-view');
            posts.forEach(post => {
                const card = createPostCard(post);
                grid.appendChild(card);
            });
        } else {
            grid.classList.remove('list-view');
            posts.forEach(post => {
                const item = document.createElement('div');
                item.className = 'grid-post-item';
                item.innerHTML = `
                    <img src="${post.image}" alt="Post image" class="grid-post-img">
                    <div class="grid-post-overlay">
                        <div class="overlay-stat">
                            <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            <span>${post.likes.length}</span>
                        </div>
                        <div class="overlay-stat">
                            <svg viewBox="0 0 24 24" stroke="white" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            <span>${post.comments.length}</span>
                        </div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    openPostDetailModal(post._id);
                });

                grid.appendChild(item);
            });
        }
    } catch (err) {
        console.error('Error fetching grid posts:', err);
    }
}

// Edit Profile Modal Handling
function setupEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal-overlay');
    const openBtn = document.getElementById('open-edit-profile-btn');
    const closeBtn = document.getElementById('close-edit-profile-btn');
    const fileLabel = document.getElementById('edit-avatar-file-label');
    const fileInput = document.getElementById('edit-avatar-file-input');
    const avatarUrlInput = document.getElementById('edit-avatar-url');
    const bioTextarea = document.getElementById('edit-bio');
    const bioLinkInput = document.getElementById('edit-bio-link');
    const githubUrlInput = document.getElementById('edit-github-url');
    const techStackInput = document.getElementById('edit-tech-stack');
    const spotlightModeInput = document.getElementById('edit-spotlight-mode');
    const profileThemeInput = document.getElementById('edit-profile-theme');
    const avatarPreview = document.getElementById('edit-avatar-preview');
    const saveBtn = document.getElementById('save-profile-btn');
    const errorMsg = document.getElementById('edit-profile-error');

    if (!modal) return;

    let localBase64Avatar = '';

    openBtn.addEventListener('click', () => {
        modal.classList.add('active');
        errorMsg.style.display = 'none';
        localBase64Avatar = '';

        // Prepopulate with current details
        const currentAvatar = document.getElementById('profile-user-avatar').src;
        const currentBio = document.getElementById('profile-bio-text').textContent;

        avatarPreview.src = currentAvatar;
        bioTextarea.value = currentBio === 'No bio description.' ? '' : currentBio;
        avatarUrlInput.value = currentAvatar.startsWith('data:image') ? '' : currentAvatar;

        if (currentProfileUser) {
            if (bioLinkInput) bioLinkInput.value = currentProfileUser.bioLink || '';
            if (githubUrlInput) githubUrlInput.value = currentProfileUser.githubUrl || '';
            if (techStackInput) techStackInput.value = currentProfileUser.techStack ? currentProfileUser.techStack.join(', ') : '';
            if (spotlightModeInput) spotlightModeInput.checked = currentProfileUser.spotlightMode || false;
            if (profileThemeInput) profileThemeInput.value = currentProfileUser.profileTheme || 'gold';
        }
    });

    function closeModal() {
        modal.classList.remove('active');
    }

    closeBtn.addEventListener('click', closeModal);

    // Click label to trigger file input
    fileLabel.addEventListener('click', () => fileInput.click());

    // File change with compression
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file, 400, 400, 0.7);
                localBase64Avatar = compressedBase64;
                avatarPreview.src = compressedBase64;
            } catch (err) {
                alert('Error uploading/compressing file');
            }
        }
    });

    // Update preview when typing/pasting URL
    avatarUrlInput.addEventListener('input', () => {
        const url = avatarUrlInput.value.trim();
        if (url) {
            avatarPreview.src = url;
            localBase64Avatar = ''; // Reset file selection
        }
    });

    if (avatarPreview) {
        avatarPreview.onerror = () => {
            const currentSrc = avatarPreview.getAttribute('src');
            if (currentSrc && currentSrc !== '' && !currentSrc.includes('dicebear.com')) {
                alert("Failed to load avatar image. Please enter a valid, public direct image URL (e.g. ending in .jpg, .png).");
                avatarPreview.src = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=default`;
                avatarUrlInput.value = '';
                localBase64Avatar = '';
            }
        };
    }

    // Save profile changes
    saveBtn.addEventListener('click', async () => {
        const avatar = localBase64Avatar || avatarUrlInput.value.trim() || undefined;
        const bio = bioTextarea.value.trim();
        const bioLink = bioLinkInput ? bioLinkInput.value.trim() : '';
        const githubUrl = githubUrlInput ? githubUrlInput.value.trim() : '';
        const techStackRaw = techStackInput ? techStackInput.value.trim() : '';
        const techStack = techStackRaw ? techStackRaw.split(',').map(s => s.trim()).filter(s => s !== '') : [];
        const spotlightMode = spotlightModeInput ? spotlightModeInput.checked : false;
        const profileTheme = profileThemeInput ? profileThemeInput.value : 'gold';

        try {
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            const response = await fetch(`${API_BASE}/users/profile`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ avatar, bio, bioLink, githubUrl, techStack, spotlightMode, profileTheme })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to update profile');

            // Update localStorage info
            const cachedUser = JSON.parse(localStorage.getItem('user'));
            if (cachedUser) {
                cachedUser.avatar = data.avatar;
                cachedUser.bio = data.bio;
                cachedUser.bioLink = data.bioLink;
                cachedUser.githubUrl = data.githubUrl;
                cachedUser.techStack = data.techStack;
                cachedUser.spotlightMode = data.spotlightMode;
                cachedUser.profileTheme = data.profileTheme;
                localStorage.setItem('user', JSON.stringify(cachedUser));
            }
            applyThemeClass(data.profileTheme);

            closeModal();
            // Reload header
            const params = new URLSearchParams(window.location.search);
            loadProfileHeader(params.get('u'));
        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.style.display = 'block';
        } finally {
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    });
}

// =============================================================
// POST DETAIL MODAL (Comments modal when click on profile grid post)
// =============================================================
let activeDetailPostId = '';

async function openPostDetailModal(postId) {
    const modal = document.getElementById('post-detail-modal-overlay');
    if (!modal) return;

    activeDetailPostId = postId;
    modal.classList.add('active');

    const detailImage = document.getElementById('detail-post-img');
    const detailAvatar = document.getElementById('detail-post-avatar');
    const detailUsername = document.getElementById('detail-post-username');
    const commentsList = document.getElementById('detail-comments-list');
    const likesCount = document.getElementById('detail-likes-count');
    const likeBtn = document.getElementById('detail-like-btn');
    const authorNav = document.getElementById('detail-author-nav');

    commentsList.innerHTML = '<p style="color: var(--text-secondary)">Loading comments...</p>';
    authorNav.onclick = null; // Clear previous listener

    try {
        // Use the new, efficient endpoint to get a single post
        const response = await fetch(`${API_BASE}/posts/${postId}`, { headers: getHeaders() });
        const targetPost = await response.json();

        if (!response.ok) throw new Error(targetPost.error || 'Post not found');

        // Populate elements
        detailImage.src = targetPost.image;
        detailAvatar.src = targetPost.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${targetPost.author.username}`;
        detailUsername.textContent = targetPost.author.username;
        likesCount.textContent = `${targetPost.likes.length} likes`;

        authorNav.onclick = () => {
            window.location.href = `profile.html?u=${targetPost.author.username}`;
        };

        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isLiked = targetPost.likes.includes(currentUser ? currentUser.id : '');
        likeBtn.classList.toggle('liked', isLiked);

        // Render Comments (Caption first, then replies)
        commentsList.innerHTML = ''; // Clear previous content

        if (targetPost.caption) {
            const captionEl = document.createElement('div');
            captionEl.className = 'comment-item';
            captionEl.style.borderBottom = '1px solid var(--border-color)';
            captionEl.style.paddingBottom = '12px';
            captionEl.style.marginBottom = '8px';
            captionEl.innerHTML = `
                <img src="${targetPost.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${targetPost.author.username}`}" class="comment-item-avatar" alt="">
                <div>
                    <span class="comment-username" onclick="window.location.href='profile.html?u=${targetPost.author.username}'">${targetPost.author.username}</span>
                    <span class="comment-text">${escapeHtml(targetPost.caption)}</span>
                    <div style="font-size:0.75rem; color: var(--text-muted); margin-top: 4px;">${formatTime(targetPost.createdAt)}</div>
                </div>
            `;
            commentsList.appendChild(captionEl);
        }

        if (targetPost.comments.length > 0) {
            targetPost.comments.forEach(c => {
                const div = document.createElement('div');
                div.className = 'comment-item';
                div.style.position = 'relative';
                
                const author = c.user || { username: c.username }; // Fallback for old comments
                const avatarSrc = author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${author.username}`;
                
                const commentUserObjectId = author._id || author.id || c.user;
                const isCommentOwner = currentUser && (commentUserObjectId === currentUser.id);
                const isPostOwner = currentUser && targetPost.author && ((targetPost.author._id || targetPost.author) === currentUser.id);
                const isAdmin = currentUser && currentUser.isAdmin;

                div.innerHTML = `
                    <img src="${avatarSrc}" class="comment-item-avatar" alt="">
                    <div style="flex: 1; padding-right: 24px;">
                        <span class="comment-username" onclick="window.location.href='profile.html?u=${author.username}'">${author.username}</span>
                        <span class="comment-text" id="comment-text-${c._id}">${escapeHtml(c.text)}</span>
                        <div style="font-size:0.75rem; color: var(--text-muted); margin-top: 4px;">${formatTime(c.createdAt || new Date())}</div>
                    </div>
                    ${(isCommentOwner || isPostOwner || isAdmin) ? `
                    <button class="comment-options-btn" style="position: absolute; right: 4px; top: 12px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; padding: 4px;" title="Comment Options">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                    </button>
                    ` : ''}
                `;
                commentsList.appendChild(div);

                const commOptionsBtn = div.querySelector('.comment-options-btn');
                if (commOptionsBtn) {
                    commOptionsBtn.onclick = () => {
                        const commOptions = [];
                        
                        if (isCommentOwner) {
                            commOptions.push({
                                label: 'Edit Comment',
                                onClick: () => {
                                    showPromptModal('Edit Comment', c.text, async (newText) => {
                                        if (newText === '') return;
                                        try {
                                            const res = await fetch(`${API_BASE}/posts/${postId}/comments/${c._id}`, {
                                                method: 'PUT',
                                                headers: getHeaders(),
                                                body: JSON.stringify({ text: newText })
                                            });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error);
                                            
                                            const commentTextEl = div.querySelector(`#comment-text-${c._id}`);
                                            if (commentTextEl) commentTextEl.textContent = newText;
                                            c.text = newText;
                                        } catch (err) {
                                            alert(err.message);
                                        }
                                    });
                                }
                            });
                        }

                        if (isCommentOwner || isPostOwner || isAdmin) {
                            commOptions.push({
                                label: 'Delete Comment',
                                danger: true,
                                onClick: () => {
                                    if (confirm('Are you sure you want to delete this comment?')) {
                                        (async () => {
                                            try {
                                                const res = await fetch(`${API_BASE}/posts/${postId}/comments/${c._id}`, {
                                                    method: 'DELETE',
                                                    headers: getHeaders()
                                                });
                                                const data = await res.json();
                                                if (!res.ok) throw new Error(data.error);
                                                
                                                div.remove();
                                                loadFeedPosts();
                                            } catch (err) {
                                                alert(err.message);
                                            }
                                        })();
                                    }
                                }
                            });
                        }

                        showActionMenu(commOptions);
                    };
                }
            });
        } else if (!targetPost.caption) {
            commentsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No comments yet.</p>';
        }

        // Setup comment posting inside detail modal
        const commentInput = document.getElementById('detail-comment-input');
        const commentSubmit = document.getElementById('detail-comment-submit-btn');

        // Reset submit button state
        commentSubmit.classList.remove('active');
        commentInput.value = '';

        commentInput.oninput = () => {
            commentSubmit.classList.toggle('active', commentInput.value.trim() !== '');
        };

        async function submitModalComment() {
            const text = commentInput.value.trim();
            if (text === '') return;

            try {
                const response = await fetch(`${API_BASE}/posts/${postId}/comment`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ text })
                });

                const newComment = await response.json();
                if (!response.ok) throw new Error(newComment.error);

                commentInput.value = '';
                commentSubmit.classList.remove('active');

                // Append comment in modal view
                const div = document.createElement('div');
                div.className = 'comment-item';
                const me = JSON.parse(localStorage.getItem('user'));
                div.innerHTML = `
                    <img src="${me.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${me.username}`}" class="comment-item-avatar" alt="">
                    <div>
                        <span class="comment-username" onclick="window.location.href='profile.html?u=${newComment.username}'">${newComment.username}</span>
                        <span class="comment-text">${escapeHtml(newComment.text)}</span>
                        <div style="font-size:0.75rem; color: var(--text-muted); margin-top: 4px;">Just now</div>
                    </div>
                `;
                commentsList.appendChild(div);

                // Refresh parent page feed/grid
                if (window.location.pathname.includes('profile.html')) {
                    loadProfileGrid();
                } else {
                    loadFeedPosts();
                }
            } catch (err) {
                alert(err.message);
            }
        }

        // Click to submit
        commentSubmit.onclick = submitModalComment;

        // Enter to submit
        commentInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitModalComment();
            }
        };

        // Setup like inside detail modal
        // Use a named function to be able to remove the listener later if needed
        likeBtn.onclick = async () => {
            try {
                const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
                    method: 'POST',
                    headers: getHeaders()
                });
                const resData = await response.json();
                if (!response.ok) throw new Error(resData.error);

                likeBtn.classList.toggle('liked', resData.liked);
                likesCount.textContent = `${resData.likesCount} likes`;

                // Refresh parent page feed/grid
                if (window.location.pathname.includes('profile.html')) {
                    loadProfileGrid();
                } else {
                    loadFeedPosts();
                }
            } catch (err) {
                console.error(err);
            }
        };

    } catch (err) {
        commentsList.innerHTML = `<p style="color: var(--accent-red); text-align: center; padding: 20px;">Error: ${err.message}</p>`;
    }
}

// Close post detail modal
const detailModal = document.getElementById('post-detail-modal-overlay');
if (detailModal) {
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.classList.remove('active');
        }
    });
}

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =============================================================
// SEARCH PANEL INTERACTIVE LOGIC
// =============================================================
function setupSearchPanel() {
    const searchBtn = document.getElementById('sidebar-search-btn');
    const panel = document.getElementById('search-slider-panel');
    const input = document.getElementById('search-users-input');
    const resultsContainer = document.getElementById('search-results-list');

    if (!searchBtn || !panel) return;

    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            input.focus();
        }
    });

    // Close panel on clicking anywhere else on page
    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== searchBtn && !searchBtn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // Debounce search requests
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        
        if (query === '') {
            resultsContainer.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
                    headers: getHeaders()
                });
                const users = await response.json();
                if (!response.ok) throw new Error(users.error);

                if (users.length === 0) {
                    resultsContainer.innerHTML = `<div class="search-no-results">No accounts found.</div>`;
                    return;
                }

                resultsContainer.innerHTML = '';
                users.forEach(user => {
                    const row = document.createElement('div');
                    row.className = 'user-profile-card';
                    row.style.padding = '8px 0';
                    row.innerHTML = `
                        <div class="user-card-info">
                            <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="Avatar" class="user-card-avatar" style="width: 36px; height: 36px;">
                            <div class="user-card-names">
                                <span class="user-card-username" style="font-size: 0.9rem;">${user.username}</span>
                                <span class="user-card-fullname" style="font-size: 0.8rem; color: var(--text-muted);">${user.bio ? (user.bio.substring(0, 25) + '...') : ''}</span>
                            </div>
                        </div>
                    `;
                    row.querySelector('.user-card-info').addEventListener('click', () => {
                        if (window.location.pathname.includes('messages.html')) {
                            openChatWindow(user);
                            panel.classList.remove('active');
                        } else {
                            window.location.href = `profile.html?u=${user.username}`;
                        }
                    });
                    resultsContainer.appendChild(row);
                });
            } catch (err) {
                resultsContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 0.85rem; text-align: center;">Error searching.</div>`;
            }
        }, 300);
    });
}

// =============================================================
// SETTINGS OVERLAY LOGIC
// =============================================================
function setupSettingsModal() {
    const modal = document.getElementById('settings-modal-overlay');
    const openBtn = document.getElementById('open-settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const oldPasswordInput = document.getElementById('settings-old-password');
    const newPasswordInput = document.getElementById('settings-new-password');
    const errorMsg = document.getElementById('settings-error');
    const successMsg = document.getElementById('settings-success');
    const privacyToggle = document.getElementById('privacy-toggle-input');

    if (!modal) return;

    openBtn.addEventListener('click', () => {
        modal.classList.add('active');
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
        oldPasswordInput.value = '';
        newPasswordInput.value = '';
        
        // Mock private account checkbox value from localStorage
        const isPrivate = localStorage.getItem('isPrivateAccount') === 'true';
        privacyToggle.checked = isPrivate;
    });

    function closeModal() {
        modal.classList.remove('active');
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    privacyToggle.addEventListener('change', () => {
        localStorage.setItem('isPrivateAccount', privacyToggle.checked);
    });

    saveBtn.addEventListener('click', async () => {
        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';

        if (!oldPassword || !newPassword) {
            errorMsg.textContent = 'Please fill out both password fields.';
            errorMsg.style.display = 'block';
            return;
        }

        try {
            saveBtn.textContent = 'Updating...';
            saveBtn.disabled = true;

            const response = await fetch(`${API_BASE}/users/change-password`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ oldPassword, newPassword })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Password update failed.');

            successMsg.textContent = 'Password updated successfully!';
            successMsg.style.display = 'block';
            oldPasswordInput.value = '';
            newPasswordInput.value = '';
        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.style.display = 'block';
        } finally {
            saveBtn.textContent = 'Update Password';
            saveBtn.disabled = false;
        }
    });
}

// =============================================================
// DIRECT CHAT / MESSAGES CONTROLLER (messages.html)
// =============================================================
let activeChatReceiverId = '';
let messagePollingInterval = null;

async function initMessagesPage() {
    if (!checkAuth()) return;

    setupNavigationLinks();
    setupCreatePostModal();
    setupSearchPanel();
    setupSettingsModal();

    // Hook search buttons inside inbox to toggle search panel
    const newChatBtn = document.getElementById('inbox-new-chat-btn');
    const emptyChatBtn = document.getElementById('empty-state-new-chat-btn');
    const searchPanelBtn = document.getElementById('sidebar-search-btn');

    if (newChatBtn) newChatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchPanelBtn.click();
    });
    if (emptyChatBtn) emptyChatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchPanelBtn.click();
    });

    // Load active conversation cards
    await loadConversationsInbox();

    // Parse query param ?u=username to start a chat directly
    const params = new URLSearchParams(window.location.search);
    const startChatUsername = params.get('u');
    if (startChatUsername) {
        try {
            const response = await fetch(`${API_BASE}/users/profile/${startChatUsername}`, { headers: getHeaders() });
            const targetUser = await response.json();
            if (response.ok) {
                openChatWindow(targetUser);
            }
        } catch (e) {
            console.error("Failed to start chat from query param:", e);
        }
    }

    // Setup input message sending
    const sendBtn = document.getElementById('chat-send-btn');
    const textInput = document.getElementById('chat-text-input');

    textInput.addEventListener('input', () => {
        if (textInput.value.trim() !== '') {
            sendBtn.classList.add('active');
        } else {
            sendBtn.classList.remove('active');
        }
    });

    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Quick heart sender
    const quickHeartBtn = document.getElementById('chat-quick-heart-btn');
    if (quickHeartBtn) {
        quickHeartBtn.addEventListener('click', async () => {
            if (!activeChatReceiverId) return;
            try {
                const response = await fetch(`${API_BASE}/messages`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        receiverId: activeChatReceiverId,
                        text: '❤️'
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);

                await loadMessagesHistory();
                await loadConversationsInbox();
            } catch (err) {
                alert('Failed to send heart: ' + err.message);
            }
        });
    }
}

// Loads active contact cards
async function loadConversationsInbox() {
    const list = document.getElementById('conversations-inbox-list');
    if (!list) return;

    // Show skeleton placeholders while loading
    list.innerHTML = Array(5).fill(`
        <div class="skeleton-inbox-item">
            <div class="skeleton skeleton-inbox-avatar"></div>
            <div class="skeleton-inbox-meta">
                <div class="skeleton skeleton-line w-60"></div>
                <div class="skeleton skeleton-line w-90"></div>
            </div>
        </div>
    `).join('');

    try {
        const response = await fetch(`${API_BASE}/messages/conversations/list`, {
            headers: getHeaders()
        });
        const conversations = await response.json();
        if (!response.ok) throw new Error(conversations.error);

        list.innerHTML = '';
        if (conversations.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No chats yet. Search a user to start chatting!</div>`;
            return;
        }

        conversations.forEach(c => {
            const div = document.createElement('div');
            div.className = `inbox-item ${activeChatReceiverId === c.user._id ? 'active' : ''}`;
            div.innerHTML = `
                <img src="${c.user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${c.user.username}`}" alt="Avatar" class="inbox-avatar">
                <div class="inbox-details">
                    <span class="inbox-username">${c.user.username}</span>
                    <p class="inbox-preview">${escapeHtml(c.lastMessage)}</p>
                </div>
            `;
            div.addEventListener('click', () => {
                // Remove active classes
                document.querySelectorAll('.inbox-item').forEach(item => item.classList.remove('active'));
                div.classList.add('active');
                
                openChatWindow(c.user);
            });
            list.appendChild(div);
        });
    } catch (err) {
        console.error('Error loading conversations:', err);
    }
}

// Opens the DM chat window for a user
async function openChatWindow(user) {
    activeChatReceiverId = user._id;

    // Toggle panels
    document.getElementById('chat-empty-state').style.display = 'none';
    document.getElementById('chat-window-active').style.display = 'flex';

    // Set header
    const headerAvatar = document.getElementById('active-chat-avatar');
    const headerUsername = document.getElementById('active-chat-username');
    
    headerAvatar.src = user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`;
    headerUsername.textContent = user.username;

    // Tap to view other profile
    headerAvatar.style.cursor = 'pointer';
    headerUsername.style.cursor = 'pointer';
    const viewProfileFn = () => {
        window.location.href = `profile.html?u=${user.username}`;
    };
    headerAvatar.onclick = viewProfileFn;
    headerUsername.onclick = viewProfileFn;

    // Load messages history
    await loadMessagesHistory();

    // Start simple polling for new messages every 3 seconds
    clearInterval(messagePollingInterval);
    messagePollingInterval = setInterval(loadMessagesHistory, 3000);
}

// Fetch messages logs with active recipient
async function loadMessagesHistory() {
    if (!activeChatReceiverId) return;

    const thread = document.getElementById('active-chat-thread');
    if (!thread) return;

    try {
        const response = await fetch(`${API_BASE}/messages/${activeChatReceiverId}`, {
            headers: getHeaders()
        });
        const messages = await response.json();
        if (!response.ok) throw new Error(messages.error);

        // Keep scroll position check
        const isAtBottom = thread.scrollHeight - thread.clientHeight <= thread.scrollTop + 100;

        thread.innerHTML = '';
        if (messages.length === 0) {
            thread.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No messages. Send a message to start the conversation!</div>`;
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user'));

        messages.forEach(msg => {
            const isMe = msg.sender === currentUser.id;
            const bubble = document.createElement('div');
            
            if (msg.sharedPostId) {
                bubble.className = `message-bubble ${isMe ? 'me' : 'other'} shared-post-bubble`;
                const post = msg.sharedPostId;
                const authorUsername = post.author ? post.author.username : 'user';
                const authorAvatar = post.author && post.author.avatar ? post.author.avatar : `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${authorUsername}`;
                const postCaption = post.caption ? (post.caption.length > 60 ? post.caption.substring(0, 60) + '...' : post.caption) : '';
                
                bubble.innerHTML = `
                    <div class="shared-post-card" onclick="openPostDetailModal('${post._id}')">
                        <div class="shared-post-header">
                            <img src="${authorAvatar}" class="shared-post-avatar" alt="">
                            <span class="shared-post-username">${authorUsername}</span>
                        </div>
                        <img src="${post.image}" class="shared-post-image" alt="">
                        ${postCaption ? `<p class="shared-post-caption">${escapeHtml(postCaption)}</p>` : ''}
                    </div>
                    <span class="message-time">${formatTime(msg.createdAt)}</span>
                `;
            } else {
                bubble.className = `message-bubble ${isMe ? 'me' : 'other'}`;
                bubble.innerHTML = `
                    ${escapeHtml(msg.text)}
                    <span class="message-time">${formatTime(msg.createdAt)}</span>
                `;
            }
            thread.appendChild(bubble);
        });

        // Scroll to bottom if we loaded first time or were already at bottom
        if (isAtBottom) {
            thread.scrollTop = thread.scrollHeight;
        }
    } catch (err) {
        console.error('Error fetching chat history:', err);
    }
}

// Sends a message to receiver
async function sendMessage() {
    const textInput = document.getElementById('chat-text-input');
    const text = textInput.value.trim();
    const sendBtn = document.getElementById('chat-send-btn');

    if (!activeChatReceiverId || text === '') return;

    try {
        textInput.value = '';
        sendBtn.classList.remove('active');

        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                receiverId: activeChatReceiverId,
                text
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // Refresh thread and inbox list
        await loadMessagesHistory();
        await loadConversationsInbox();
    } catch (err) {
        alert('Failed to send message: ' + err.message);
    }
}

// -------------------------------------------------------------
// POST DETAIL MODAL (SINGLE POST VIEW)
// -------------------------------------------------------------
async function openPostDetailModal(postId) {
    const modal = document.getElementById('post-detail-modal-overlay');
    if (!modal) return;

    const img = document.getElementById('detail-post-img');
    const avatar = document.getElementById('detail-post-avatar');
    const username = document.getElementById('detail-post-username');
    const catBadge = document.getElementById('detail-post-category-badge');
    const commentsList = document.getElementById('detail-comments-list');
    const likesCount = document.getElementById('detail-likes-count');
    const likeBtn = document.getElementById('detail-like-btn');
    const commentInput = document.getElementById('detail-comment-input');
    const commentSubmit = document.getElementById('detail-comment-submit-btn');
    const authorNav = document.getElementById('detail-author-nav');

    if (commentsList) commentsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Loading post details...</p>';
    modal.classList.add('active');

    try {
        const response = await fetch(`${API_BASE}/posts/single/${postId}`, { headers: getHeaders() });
        const post = await response.json();
        if (!response.ok) throw new Error(post.error || 'Failed to load post');

        if (img) img.src = post.image;
        if (avatar) avatar.src = post.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${post.author.username}`;
        if (username) username.textContent = post.author.username;
        if (catBadge) catBadge.innerHTML = getCategoryBadgeHTML(post.category);

        if (authorNav) {
            authorNav.onclick = () => {
                window.location.href = `profile.html?u=${post.author.username}`;
            };
        }

        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isLiked = post.likes ? post.likes.includes(currentUser ? currentUser.id : '') : false;

        if (likeBtn) {
            likeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="22" height="22" fill="${isLiked ? 'var(--accent-red)' : 'none'}" stroke="${isLiked ? 'var(--accent-red)' : 'currentColor'}" stroke-width="2">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            `;
            likeBtn.onclick = async () => {
                try {
                    const lRes = await fetch(`${API_BASE}/posts/${post._id}/like`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const lData = await lRes.json();
                    if (!lRes.ok) throw new Error(lData.error);
                    openPostDetailModal(postId); // Refresh modal
                } catch (e) {
                    alert(e.message);
                }
            };
        }

        if (likesCount) likesCount.textContent = `${post.likes ? post.likes.length : 0} like${(post.likes && post.likes.length !== 1) ? 's' : ''}`;

        // Render Comments and Caption
        if (commentsList) {
            commentsList.innerHTML = `
                <div style="display:flex;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--border-color);">
                    <img src="${post.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${post.author.username}`}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="">
                    <div>
                        <span style="font-weight:700;color:var(--text-primary);margin-right:6px;">${post.author.username}</span>
                        <span style="color:var(--text-primary);">${escapeHtml(post.caption || '')}</span>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${formatTime(post.createdAt)}</div>
                    </div>
                </div>
            `;

            if (!post.comments || post.comments.length === 0) {
                commentsList.innerHTML += `<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem;">No comments yet. Be the first to comment!</p>`;
            } else {
                post.comments.forEach(c => {
                    const cAuthor = c.author || { username: 'user', avatar: '' };
                    const cDiv = document.createElement('div');
                    cDiv.style.cssText = 'display:flex;gap:12px;align-items:flex-start;';
                    cDiv.innerHTML = `
                        <img src="${cAuthor.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${cAuthor.username}`}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="">
                        <div style="flex:1;">
                            <span style="font-weight:600;color:var(--text-primary);margin-right:6px;font-size:0.85rem;">${cAuthor.username}</span>
                            <span style="color:var(--text-primary);font-size:0.85rem;">${escapeHtml(c.text)}</span>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${formatTime(c.createdAt || post.createdAt)}</div>
                        </div>
                    `;
                    commentsList.appendChild(cDiv);
                });
            }
        }

        // Comment submission
        if (commentSubmit && commentInput) {
            commentSubmit.onclick = async () => {
                const text = commentInput.value.trim();
                if (!text) return;
                try {
                    commentSubmit.disabled = true;
                    const cRes = await fetch(`${API_BASE}/posts/${post._id}/comment`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ text })
                    });
                    const cData = await cRes.json();
                    if (!cRes.ok) throw new Error(cData.error);
                    commentInput.value = '';
                    openPostDetailModal(postId); // Refresh modal
                } catch (e) {
                    alert(e.message);
                } finally {
                    commentSubmit.disabled = false;
                }
            };
        }

    } catch (err) {
        if (commentsList) commentsList.innerHTML = `<p style="color:var(--accent-red);text-align:center;padding:20px;">${err.message}</p>`;
    }
}

// Global listener for post detail closing
document.addEventListener('DOMContentLoaded', () => {
    const detailOverlay = document.getElementById('post-detail-modal-overlay');
    const closeBtn = document.getElementById('close-detail-modal');
    if (closeBtn && detailOverlay) {
        closeBtn.addEventListener('click', () => {
            detailOverlay.classList.remove('active');
        });
    }
    if (detailOverlay) {
        detailOverlay.addEventListener('click', (e) => {
            if (e.target === detailOverlay) {
                detailOverlay.classList.remove('active');
            }
        });
    }
});
