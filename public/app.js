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
                if (!window.location.pathname.includes('auth')) {
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
// Global Navigation Link Setup (Profile URL, Admin Panel visibility, Logout)
function setupNavigationLinks() {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const username = cachedUser ? cachedUser.username : '';

    const profileLinks = document.querySelectorAll('#sidebar-profile-link, #mobile-profile-link, [aria-label="Profile"]');
    profileLinks.forEach(link => {
        if (link) {
            link.setAttribute('href', username ? `profile.html?u=${encodeURIComponent(username)}` : 'profile.html');
            link.onclick = (e) => {
                e.preventDefault();
                window.location.href = username ? `profile.html?u=${encodeURIComponent(username)}` : 'profile.html';
            };
        }
    });

    const adminItem = document.getElementById('sidebar-admin-item');
    if (adminItem && cachedUser && cachedUser.isAdmin) {
        adminItem.classList.remove('d-none');
        adminItem.style.display = 'block';
    }

    const logoutBtns = document.querySelectorAll('#logout-btn, [aria-label="Log Out"]');
    logoutBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'auth.html';
        };
    });
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
                const isCurrentActiveChat = ((window.location.pathname.includes('messages') || window.location.pathname.endsWith('/messages')) && typeof activeChatReceiverId !== 'undefined' && activeChatReceiverId === userId);

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
        const data = await response.json();
        if (!response.ok) return;

        const notifications = Array.isArray(data) ? data : (data.notifications || []);
        const unreadCount = typeof data.unreadCount === 'number' ? data.unreadCount : notifications.filter(n => !n.isRead).length;

        const badge = document.getElementById('notif-count-badge');
        const mobBadge = document.getElementById('mobile-notif-count-badge');

        if (badge) {
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            badge.textContent = unreadCount;
        }
        if (mobBadge) {
            mobBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            mobBadge.textContent = unreadCount;
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

// Web Audio Synthesizer for UI sound effects
function playActionSound(type = 'like') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'like') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);
        } else if (type === 'share') {
            osc.frequency.setValueAtTime(659.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        } else if (type === 'comment') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.1);
        }

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

// Interactive Notifications Panel Modal
function setupNotificationPanel() {
    const notifBtn = document.getElementById('sidebar-notifications-btn');
    const mobNotifBtn = document.getElementById('mobile-notifications-btn');

    async function openNotificationPanel() {
        try {
            const res = await fetch(`${API_BASE}/notifications`, { headers: getHeaders() });
            const notifications = await res.json();
            if (!res.ok) return;

            let notifHTML = '';
            if (notifications.length === 0) {
                notifHTML = `
                    <div style="text-align: center; padding: 50px 20px; color: var(--text-secondary);">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5" style="margin-bottom: 12px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        <p style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">No notifications yet</p>
                        <p style="font-size: 0.82rem; margin-top: 6px;">When people follow you or like your posts, you'll see them here!</p>
                    </div>
                `;
            } else {
                notifications.forEach(n => {
                    const senderAvatar = n.sender ? (n.sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${n.sender.username}`) : 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=default';
                    const senderName = n.sender ? n.sender.username : 'Someone';
                    const postImg = n.post && n.post.image ? `<img src="${n.post.image}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; margin-left: auto;">` : '';

                    notifHTML += `
                        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border-color); background: ${n.isRead ? 'transparent' : 'rgba(255,203,5,0.06)'}; cursor: pointer; transition: background 0.2s;" onclick="window.location.href='profile.html?u=${senderName}'">
                            <img src="${senderAvatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-gold);">
                            <div style="flex: 1; min-width: 0;">
                                <p style="font-size: 0.88rem; color: var(--text-primary); margin: 0; line-height: 1.3;">
                                    <strong style="color: var(--accent-gold);">${escapeHtml(senderName)}</strong> ${escapeHtml(n.text || getNotificationText(n))}
                                </p>
                                <span style="font-size: 0.76rem; color: var(--text-muted);">${formatTime(n.createdAt)}</span>
                            </div>
                            ${postImg}
                        </div>
                    `;
                });
            }

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.display = 'flex';
            overlay.style.zIndex = '10005';

            overlay.innerHTML = `
                <div style="position: relative; width: 100%; max-width: 440px; height: 85vh; background: var(--bg-secondary); border-radius: 20px; border: 1.5px solid var(--accent-gold); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); background: var(--bg-primary);">
                        <h3 style="margin: 0; font-size: 1.05rem; color: var(--accent-gold); display: flex; align-items: center; gap: 8px; font-weight: 700;">
                            🔔 Notifications
                        </h3>
                        <button id="close-notif-modal-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto;">
                        ${notifHTML}
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.querySelector('#close-notif-modal-btn').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        } catch (err) {
            console.error('Notification open error:', err);
        }
    }

    if (notifBtn) notifBtn.addEventListener('click', openNotificationPanel);
    if (mobNotifBtn) mobNotifBtn.addEventListener('click', openNotificationPanel);
}

// Global Keyboard Shortcuts (Ctrl + K for Search, Escape to Close)
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const searchPanel = document.getElementById('search-slider-panel');
            if (searchPanel) {
                searchPanel.classList.add('active');
                const searchInput = document.getElementById('search-panel-input');
                if (searchInput) searchInput.focus();
            }
        }
        if (e.key === 'Escape') {
            const overlays = document.querySelectorAll('.modal-overlay');
            overlays.forEach(m => {
                if (m.style.display !== 'none') m.style.display = 'none';
            });
            const searchPanel = document.getElementById('search-slider-panel');
            if (searchPanel) searchPanel.classList.remove('active');
        }
    });
}

// Helper: Get clean readable notification text
function getNotificationText(n) {
    if (n.text) return n.text;
    switch (n.type) {
        case 'like': return 'liked your post.';
        case 'comment': return 'commented on your post.';
        case 'follow': return 'started following you.';
        case 'mention': return 'mentioned you in a post.';
        case 'message': return 'sent you a message.';
        default: return 'sent a notification.';
    }
}

// Implement Live Search Slider Panel
function setupSearchSliderPanel() {
    setupSearchPanel();
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
            if (!res.ok) throw new Error(notifications.error || 'Failed to fetch notifications');

            if (!Array.isArray(notifications) || notifications.length === 0) {
                list.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No notifications yet.</div>`;
                return;
            }

            list.innerHTML = '';
            notifications.forEach(n => {
                const row = document.createElement('div');
                row.className = `notification-item ${n.isRead ? '' : 'unread'}`;
                row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;';
                
                const sender = n.sender || { username: 'Spotlite User', avatar: '' };
                const senderUsername = sender.username || 'Spotlite User';
                const senderAvatar = sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${senderUsername}`;

                const relativeTime = formatTime(n.createdAt);
                const text = getNotificationText(n);
                
                row.innerHTML = `
                    <img src="${senderAvatar}"
                         style="width:42px;height:42px;border-radius:50%;object-fit:cover;" alt="">
                    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:0.88rem;color:var(--text-primary);">
                            <strong style="font-weight:600;" onclick="window.location.href='profile.html?u=${senderUsername}'">${escapeHtml(senderUsername)}</strong> ${escapeHtml(text)}
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
                            window.location.href = `profile.html?u=${senderUsername}`;
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
    if (!token && !window.location.pathname.includes('auth')) {
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
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        console.warn('Failed to parse currentUser:', e);
    }

    if (currentUser && currentUser.username) {
        document.querySelectorAll('#sidebar-profile-link, #mobile-profile-link, [aria-label="Profile"]').forEach(link => {
            if (link.tagName === 'A') {
                link.href = `profile.html?u=${currentUser.username}`;
            } else {
                link.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = `profile.html?u=${currentUser.username}`;
                };
            }
        });

        const userNav = document.getElementById('current-user-nav');
        if (userNav) {
            userNav.onclick = () => {
                window.location.href = `profile.html?u=${currentUser.username}`;
            };
        }
    } else {
        document.querySelectorAll('#sidebar-profile-link, #mobile-profile-link, [aria-label="Profile"]').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                window.location.href = 'auth.html';
            };
        });
    }

    // Wire mobile & sidebar search buttons
    document.querySelectorAll('#mobile-search-btn, #sidebar-search-btn, [aria-label="Search"]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const searchPanel = document.getElementById('search-slider-panel');
            if (searchPanel) {
                searchPanel.classList.add('active');
                const searchInput = document.getElementById('search-panel-input') || document.getElementById('search-users-input');
                if (searchInput) searchInput.focus();
            }
        };
    });

    // Wire mobile & sidebar notification buttons
    document.querySelectorAll('#mobile-notifications-btn, #sidebar-notifications-btn, [aria-label="Notifications"]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const notifPanel = document.getElementById('notifications-slider-panel');
            if (notifPanel) {
                notifPanel.classList.add('active');
                if (typeof loadUserNotifications === 'function') loadUserNotifications();
            }
        };
    });

    // Wire mobile & sidebar settings buttons
    document.querySelectorAll('#mobile-settings-btn, #sidebar-settings-btn, #open-settings-btn, [aria-label="Settings"]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const settingsModal = document.getElementById('settings-modal') || document.getElementById('settings-modal-overlay');
            if (settingsModal) {
                settingsModal.style.display = 'flex';
            }
        };
    });

    setupSearchSliderPanel();
    setupNotificationsSliderPanel();
}

function setupSearchSliderPanel() {
    const searchPanel = document.getElementById('search-slider-panel');
    const searchInput = document.getElementById('search-panel-input') || document.getElementById('search-users-input');
    const closeBtn = document.getElementById('close-search-slider-btn') || document.getElementById('close-search-panel-btn');

    if (!searchPanel) return;

    if (closeBtn) {
        closeBtn.onclick = () => searchPanel.classList.remove('active');
    }

    let resultsContainer = searchPanel.querySelector('.search-results-container') || searchPanel.querySelector('#search-results-list');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results-container';
        resultsContainer.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 120px); overflow-y: auto;';
        searchPanel.appendChild(resultsContainer);
    }

    async function performSearch(query = '') {
        resultsContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:16px; font-size:0.85rem;">Searching Spotlite users...</p>';
        try {
            const url = query.trim()
                ? `${API_BASE}/users/search?q=${encodeURIComponent(query.trim())}`
                : `${API_BASE}/users`;
            
            const res = await fetch(url, { headers: getHeaders() });
            const data = await res.json();
            const users = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
            
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const myId = currentUser.id || currentUser._id;
            const filtered = users.filter(u => u._id !== myId && u.id !== myId);

            if (filtered.length === 0) {
                resultsContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:16px; font-size:0.85rem;">No users found</p>';
                return;
            }

            resultsContainer.innerHTML = '';
            
            if (!query.trim()) {
                const header = document.createElement('div');
                header.style.cssText = 'font-size: 0.82rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 8px; padding-left: 4px;';
                header.textContent = '✨ Suggested for you';
                resultsContainer.appendChild(header);
            }

            filtered.forEach(u => {
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-input); border-radius: 12px; cursor: pointer; transition: background 0.2s;';
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); display: block;">@${escapeHtml(u.username)}</span>
                            <span style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(u.bio || 'Spotlite user')}</span>
                        </div>
                    </div>
                    <button class="btn-primary" style="padding: 4px 12px; font-size: 0.78rem;">Profile</button>
                `;
                item.onclick = () => {
                    searchPanel.classList.remove('active');
                    window.location.href = `profile.html?u=${u.username}`;
                };
                resultsContainer.appendChild(item);
            });
        } catch (err) {
            resultsContainer.innerHTML = '<p style="color:var(--accent-red); text-align:center; padding:16px; font-size:0.85rem;">Failed to load search results</p>';
        }
    }

    if (searchInput) {
        let debounceTimer;
        searchInput.oninput = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => performSearch(searchInput.value), 200);
        };
        searchInput.onfocus = () => {
            performSearch(searchInput.value);
        };
    }
}

function setupNotificationsSliderPanel() {
    const notifPanel = document.getElementById('notifications-slider-panel');
    const closeBtn = document.getElementById('close-notifications-slider-btn');

    if (!notifPanel) return;

    if (closeBtn) {
        closeBtn.onclick = () => notifPanel.classList.remove('active');
    }
}

// =============================================================
// HOME FEED & PAGE INITIALIZERS (index.html, admin.html, call.html)
// =============================================================
async function initFeedPage() {
    setupNavigationLinks();
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }
    if (typeof loadFeedPosts === 'function') {
        loadFeedPosts();
    }
    if (typeof loadStoriesBar === 'function') {
        loadStoriesBar();
    }
}

async function initAdminPage() {
    setupNavigationLinks();
    if (typeof loadAdminDashboard === 'function') {
        loadAdminDashboard();
    }
}

function initCallPage() {
    setupNavigationLinks();
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
                            verifyError.textContent = data.error || 'Please verify your email address.';
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
                if (verifyCodeInput) verifyCodeInput.value = '';
                if (verifyEmailHidden) verifyEmailHidden.value = data.email;
                if (signupCard) signupCard.style.display = 'none';
                if (loginCard) loginCard.style.display = 'none';
                if (verifyCard) verifyCard.style.display = 'block';
                if (verifyError) verifyError.style.display = 'none';
                if (verifySuccess) {
                    verifySuccess.innerHTML = 'Registration successful! A 6-digit verification code has been sent to your email address.';
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

                if (verifyCodeInput) verifyCodeInput.value = '';

                if (verifySuccess) {
                    verifySuccess.innerHTML = data.message || 'A new verification code has been sent to your email address.';
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
    const modal = document.getElementById('create-post-modal-overlay') || document.getElementById('create-post-modal');
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

    let selectedPostImageBase64 = '';
    let selectedPostFilter = 'none';

    function openModal() {
        modal.style.cssText = 'display: flex !important;';
        modal.classList.add('active');
        resetModal();
    }

    function closeModal() {
        modal.style.cssText = 'display: none !important;';
        modal.classList.remove('active');
        resetModal();
    }

    function resetModal() {
        selectedPostImageBase64 = '';
        selectedPostFilter = 'none';
        fileInput.value = '';
        urlInput.value = '';
        previewImg.src = '';
        previewImg.style.filter = 'none';
        captionInput.value = '';
        const locInput = document.getElementById('post-location-input');
        if (locInput) locInput.value = '';
        
        // Reset filter pills
        const filterPills = document.querySelectorAll('.filter-pill');
        filterPills.forEach(p => {
            if (p.getAttribute('data-filter') === 'none') {
                p.style.borderColor = 'var(--accent-gold)';
                p.style.color = 'var(--accent-gold)';
            } else {
                p.style.borderColor = 'var(--border-color)';
                p.style.color = 'var(--text-secondary)';
            }
        });
        const moodSelectTop = document.getElementById('post-mood-select-top');
        if (moodSelectTop) moodSelectTop.value = '';
        const moodSelect = document.getElementById('post-mood-select');
        if (moodSelect) moodSelect.value = '';
        const customMoodWrapper = document.getElementById('post-custom-mood-wrapper');
        const customMoodInput = document.getElementById('post-custom-mood-input');
        if (customMoodWrapper) customMoodWrapper.style.display = 'none';
        if (customMoodInput) customMoodInput.value = '';
        
        const categorySelect = document.getElementById('post-category-select');
        if (categorySelect) categorySelect.value = 'General';
        const categorySelectDrop = document.getElementById('post-category-select-drop');
        if (categorySelectDrop) categorySelectDrop.value = 'General';
        const customWrapper = document.getElementById('post-custom-category-wrapper');
        const customInput = document.getElementById('post-custom-category-input');
        if (customWrapper) customWrapper.style.display = 'none';
        if (customInput) customInput.value = '';
        const charCounter = document.getElementById('caption-char-counter');
        if (charCounter) charCounter.textContent = '0 / 500';
        
        // Reset category button pills
        const catBtnPills = document.querySelectorAll('.category-btn-pill');
        catBtnPills.forEach(btn => {
            if (btn.getAttribute('data-value') === 'General') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

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

    // Post Mood Change Handler & Top Sync
    const moodSelectTop = document.getElementById('post-mood-select-top');
    const moodSelect = document.getElementById('post-mood-select');
    const customMoodWrapper = document.getElementById('post-custom-mood-wrapper');
    const customMoodInput = document.getElementById('post-custom-mood-input');

    function syncMoodSelection(val) {
        if (moodSelectTop) moodSelectTop.value = val;
        if (moodSelect) moodSelect.value = val;
        if (customMoodWrapper) {
            if (val === 'Other') {
                customMoodWrapper.style.display = 'flex';
                if (customMoodInput) customMoodInput.focus();
            } else {
                customMoodWrapper.style.display = 'none';
            }
        }
    }

    if (moodSelectTop) moodSelectTop.addEventListener('change', () => syncMoodSelection(moodSelectTop.value));
    if (moodSelect) moodSelect.addEventListener('change', () => syncMoodSelection(moodSelect.value));

    // Category Buttons Row & Dropdown sync
    const categorySelect = document.getElementById('post-category-select');
    const categorySelectDrop = document.getElementById('post-category-select-drop');
    const customWrapper = document.getElementById('post-custom-category-wrapper');
    const customInput = document.getElementById('post-custom-category-input');
    const catButtonsRow = document.getElementById('modal-category-buttons-row');

    function syncCategorySelection(val) {
        if (categorySelect) categorySelect.value = val;
        if (categorySelectDrop) categorySelectDrop.value = val;
        if (catButtonsRow) {
            catButtonsRow.querySelectorAll('.category-btn-pill').forEach(btn => {
                if (btn.getAttribute('data-value') === val) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        if (customWrapper) {
            if (val === 'Other') {
                customWrapper.style.display = 'flex';
                if (customInput) customInput.focus();
            } else {
                customWrapper.style.display = 'none';
            }
        }
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => syncCategorySelection(categorySelect.value));
    }
    if (categorySelectDrop) {
        categorySelectDrop.addEventListener('change', () => syncCategorySelection(categorySelectDrop.value));
    }

    if (catButtonsRow) {
        catButtonsRow.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn-pill');
            if (btn) {
                const val = btn.getAttribute('data-value');
                if (val) syncCategorySelection(val);
            }
        });
    }
    // Character counter & Quick Hashtags
    const charCounter = document.getElementById('caption-char-counter');
    if (captionInput && charCounter) {
        captionInput.addEventListener('input', () => {
            charCounter.textContent = `${captionInput.value.length} / 500`;
            if (captionInput.value.length > 500) {
                charCounter.style.color = 'var(--accent-red)';
            } else {
                charCounter.style.color = 'var(--text-muted)';
            }
        });
    }

    const hashtagContainer = document.getElementById('quick-hashtag-chips');
    if (hashtagContainer && captionInput) {
        hashtagContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.hashtag-chip');
            if (chip) {
                const tag = chip.getAttribute('data-tag');
                if (tag && !captionInput.value.includes(tag)) {
                    captionInput.value = captionInput.value ? `${captionInput.value.trim()} ${tag}` : tag;
                    if (charCounter) charCounter.textContent = `${captionInput.value.length} / 500`;
                }
            }
        });
    }

    // Photo filter preset selection
    const filterPillsContainer = document.getElementById('photo-filters-bar');
    if (filterPillsContainer) {
        filterPillsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-pill');
            if (btn) {
                const filterVal = btn.getAttribute('data-filter') || 'none';
                selectedPostFilter = filterVal;
                if (previewImg) previewImg.style.filter = filterVal;

                filterPillsContainer.querySelectorAll('.filter-pill').forEach(p => {
                    p.style.borderColor = 'var(--border-color)';
                    p.style.color = 'var(--text-secondary)';
                });
                btn.style.borderColor = 'var(--accent-gold)';
                btn.style.color = 'var(--accent-gold)';
            }
        });
    }

    // Quick Post Creator Box trigger on Home Feed
    const quickPostTrigger = document.getElementById('quick-post-trigger');
    if (quickPostTrigger) {
        quickPostTrigger.addEventListener('click', (e) => {
            openModal();
            const chip = e.target.closest('.quick-action-chip');
            if (chip) {
                const chipText = chip.textContent.toLowerCase();
                if (chipText.includes('photo')) {
                    fileInput.click();
                } else if (chipText.includes('mood')) {
                    const moodSelectTop = document.getElementById('post-mood-select-top');
                    if (moodSelectTop) moodSelectTop.focus();
                } else if (chipText.includes('location')) {
                    const locInput = document.getElementById('post-location-input');
                    if (locInput) locInput.focus();
                } else if (chipText.includes('category')) {
                    const catRow = document.getElementById('modal-category-buttons-row');
                    if (catRow) catRow.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }

    // Event Listeners for Create Post modal
    document.querySelectorAll('#sidebar-create-btn, #open-create-modal, #open-create-btn, #mobile-open-create-btn, .bottom-create-btn, #empty-state-new-post-btn, [aria-label="Create Post"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        });
    });
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
        const moodSelectTop = document.getElementById('post-mood-select-top');
        const moodSelect = document.getElementById('post-mood-select');
        let mood = (moodSelectTop && moodSelectTop.value) ? moodSelectTop.value : (moodSelect ? moodSelect.value : '');
        if (mood === 'Other') {
            const customMoodInput = document.getElementById('post-custom-mood-input');
            mood = customMoodInput ? customMoodInput.value.trim() : '';
        }

        if (!mood) {
            alert('⚠️ Post Mood is required! Please select or enter a post mood before sharing.');
            if (moodSelectTop) moodSelectTop.focus();
            return;
        }

        const locInput = document.getElementById('post-location-input');
        const location = locInput ? locInput.value.trim() : '';
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
                    category,
                    location,
                    filter: selectedPostFilter
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create post');

            closeModal();
            // Refresh feed or user profile grid
            if (window.location.pathname.includes('profile')) {
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
    setupNotificationPanel();
    setupKeyboardShortcuts();
    setupSettingsModal();
    loadCurrentUserCard();
    setupCategoryFilterBar();
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
    const quickPostAvatar = document.getElementById('quick-post-user-avatar');
    const username = document.getElementById('current-user-username');
    const bio = document.getElementById('current-user-bio');

    const userAvatarUrl = user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`;
    if (avatar) avatar.src = userAvatarUrl;
    if (quickPostAvatar) quickPostAvatar.src = userAvatarUrl;
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
let activeCategoryFilter = 'all';

// Helper to show floating toast alert
function showSpotliteToast(msg) {
    const existing = document.querySelector('.spotlite-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'spotlite-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}

// Instagram-Style 24-Hour Note Prompt & Modal
async function openNoteModal() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const existingNote = currentUser.note ? currentUser.note.text || '' : '';
    
    showPromptModal('Share a Thought / Note 💬 (max 60 chars)', existingNote, async (newText) => {
        const text = newText.trim().substring(0, 60);
        try {
            const res = await fetch(`${API_BASE}/users/note`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update note');
            
            currentUser.note = data.note;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showSpotliteToast('Note updated! 💬');
            loadStoriesBar();
        } catch (err) {
            alert(err.message);
        }
    });
}
window.openNoteModal = openNoteModal;

// Full-Resolution Profile Avatar Viewer Modal
function openAvatarViewerModal(avatarUrl, username) {
    if (!avatarUrl) return;
    const existing = document.querySelector('.avatar-viewer-overlay');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'avatar-viewer-overlay';
    modal.innerHTML = `
        <div class="avatar-viewer-card">
            <h3 style="color: var(--text-primary); font-weight: 800; font-size: 1.2rem; margin: 0;">@${escapeHtml(username || 'user')}</h3>
            <img src="${avatarUrl}" alt="Avatar Full View">
            <button class="hub-action-btn primary" id="close-avatar-viewer-btn" style="width: 100%; border-radius: 14px; margin-top: 10px;">Close View</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-avatar-viewer-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// Attach Long Press & Click listeners to profile images across the app
function setupAvatarViewerListeners() {
    document.querySelectorAll('.profile-avatar-img, .user-card-avatar, #profile-user-avatar').forEach(img => {
        let timer = null;
        let isLongPress = false;

        const startPress = () => {
            isLongPress = false;
            timer = setTimeout(() => {
                isLongPress = true;
                const username = document.getElementById('profile-username')?.textContent || 'user';
                openAvatarViewerModal(img.src, username);
            }, 400);
        };

        const endPress = () => {
            if (timer) clearTimeout(timer);
        };

        img.addEventListener('mousedown', startPress);
        img.addEventListener('mouseup', endPress);
        img.addEventListener('mouseleave', endPress);
        img.addEventListener('touchstart', startPress, { passive: true });
        img.addEventListener('touchend', endPress);
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = document.getElementById('profile-username')?.textContent || 'user';
            openAvatarViewerModal(img.src, username);
        });
    });
}

window.openSettingsModal = function() {
    let modal = document.getElementById('settings-modal-overlay') || document.getElementById('settings-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px; width: 90%; background: rgba(18, 22, 28, 0.98); border: 1.5px solid var(--accent-gold); border-radius: 20px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.85); position: relative;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--accent-gold); font-weight: 800; display: flex; align-items: center; gap: 8px;">⚙️ System Settings & Theme</h3>
                    <button id="close-settings-modal-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 18px;">
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 8px;">Theme Accent Glow</label>
                        <div style="display: flex; gap: 10px;">
                            <button class="theme-accent-opt active" data-theme="gold" style="flex: 1; padding: 10px; border-radius: 12px; border: 1.5px solid var(--accent-gold); background: rgba(255,203,5,0.15); color: #ffcb05; font-weight: 700; cursor: pointer;">✨ Gold Glow</button>
                            <button class="theme-accent-opt" data-theme="purple" style="flex: 1; padding: 10px; border-radius: 12px; border: 1.5px solid #a855f7; background: rgba(168,85,247,0.15); color: #c084fc; font-weight: 700; cursor: pointer;">🔮 Cyber Violet</button>
                            <button class="theme-accent-opt" data-theme="emerald" style="flex: 1; padding: 10px; border-radius: 12px; border: 1.5px solid #10b981; background: rgba(16,185,129,0.15); color: #34d399; font-weight: 700; cursor: pointer;">🌿 Emerald</button>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 6px;">Change Password</label>
                        <input type="password" id="settings-old-password" placeholder="Current Password" style="width: 100%; padding: 10px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 8px; font-size: 0.85rem;">
                        <input type="password" id="settings-new-password" placeholder="New Password" style="width: 100%; padding: 10px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-size: 0.85rem;">
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                        <a href="auth.html" onclick="localStorage.clear();" style="color: var(--accent-red); font-weight: 700; font-size: 0.88rem; text-decoration: none;">🚪 Log Out Account</a>
                        <button id="save-settings-btn" class="btn-save-glow" style="background: var(--spotlite-gradient); color: #000; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer;">Save Preferences ✨</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.cssText = 'display: flex !important; z-index: 999999;';
    setupSettingsModal();
};

window.openSettingsModal = function() {
    let modal = document.getElementById('settings-modal-overlay') || document.getElementById('settings-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex !important; z-index: 999999;';
        modal.innerHTML = `
            <div style="position: relative; max-width: 440px; width: 90%; background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: 20px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: var(--accent-gold); font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">⚙️ System Settings & Theme</h3>
                    <button id="close-settings-dyn-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 0.92rem; color: var(--text-secondary);">Account Password</h4>
                    <input type="password" id="settings-old-pass-input" placeholder="Current password" style="width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 10px; font-size: 0.9rem;">
                    <input type="password" id="settings-new-pass-input" placeholder="New password" style="width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 12px; font-size: 0.9rem;">
                    <button id="update-pass-submit-btn" class="btn-primary" style="width: 100%; padding: 10px;">Update Password 🔐</button>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 0.92rem; color: var(--text-secondary);">Preferences</h4>
                    <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem; cursor: pointer;">
                        <span>🔔 Enable Sound Notifications</span>
                        <input type="checkbox" id="settings-sound-chk" checked style="width: 18px; height: 18px; accent-color: var(--accent-gold);">
                    </label>
                    <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem; cursor: pointer;">
                        <span>✨ High Performance Animations</span>
                        <input type="checkbox" id="settings-anim-chk" checked style="width: 18px; height: 18px; accent-color: var(--accent-gold);">
                    </label>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#close-settings-dyn-btn').onclick = () => { modal.style.cssText = 'display: none !important;'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.cssText = 'display: none !important;'; };

        modal.querySelector('#update-pass-submit-btn').onclick = async () => {
            const currentPassword = modal.querySelector('#settings-old-pass-input').value;
            const newPassword = modal.querySelector('#settings-new-pass-input').value;
            if (!currentPassword || !newPassword) {
                if (typeof showSpotliteToast === 'function') showSpotliteToast('❌ Please fill in both password fields');
                else alert('Please fill in both password fields');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/users/change-password`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error);
                if (typeof showSpotliteToast === 'function') showSpotliteToast('✨ Password updated successfully!');
                else alert('Password updated successfully!');
                modal.querySelector('#settings-old-pass-input').value = '';
                modal.querySelector('#settings-new-pass-input').value = '';
                modal.style.cssText = 'display: none !important;';
            } catch (err) {
                if (typeof showSpotliteToast === 'function') showSpotliteToast(`❌ ${err.message || 'Failed to update password'}`);
                else alert(err.message || 'Failed to update password');
            }
        };
    }

    modal.style.cssText = 'display: flex !important; z-index: 999999;';
    modal.classList.add('active');

    const closeBtns = modal.querySelectorAll('#close-settings-btn, #close-settings-modal-btn, .close-modal');
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            modal.style.cssText = 'display: none !important;';
            modal.classList.remove('active');
        };
    });
};

window.setupGlobalNavigationListeners = function() {
    if (window._hasGlobalNavListenersAttached) return;
    window._hasGlobalNavListenersAttached = true;

    document.addEventListener('click', (e) => {
        const settingsBtn = e.target.closest('#open-settings-btn, #mobile-settings-btn, [aria-label="Settings"], [title="Settings"]');
        if (settingsBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.openSettingsModal();
            return;
        }

        const addStoryBtn = e.target.closest('#open-add-story-btn, #user-note-trigger, .user-story-add, [aria-label="Add Story"]');
        if (addStoryBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.openAddStoryModal();
            return;
        }

        const newChatBtn = e.target.closest('#inbox-new-chat-btn, #empty-state-new-chat-btn');
        if (newChatBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.openNewChatPanel();
            return;
        }

        const newGroupBtn = e.target.closest('#inbox-new-group-btn');
        if (newGroupBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.openGroupChatModal();
            return;
        }

        const createBtn = e.target.closest('#sidebar-create-btn, #open-create-btn, #mobile-open-create-btn, .bottom-create-btn, [aria-label="Create Post"]');
        if (createBtn) {
            e.preventDefault();
            e.stopPropagation();
            let createModal = document.getElementById('create-post-modal-overlay') || document.getElementById('create-post-modal');
            if (createModal) {
                createModal.style.cssText = 'display: flex !important; z-index: 999999;';
                createModal.classList.add('active');
                if (typeof setupCreatePostModal === 'function') setupCreatePostModal();
            }
            return;
        }
    });
};

// Immediately initialize global navigation listeners
window.setupGlobalNavigationListeners();

window.openAddStoryModal = function() {
    let modal = document.getElementById('add-story-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-story-modal-overlay';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex !important; z-index: 999999;';
        modal.innerHTML = `
            <div style="position: relative; max-width: 440px; width: 90%; background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: 20px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: var(--accent-gold); font-size: 1.1rem; font-weight: 700;">📸 Add to Your Story (24h)</h3>
                    <button id="close-add-story-modal-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div style="text-align: center; margin-bottom: 16px;">
                    <img id="story-media-preview" src="" style="max-width: 100%; max-height: 260px; border-radius: 12px; display: none; object-fit: contain; margin: 0 auto 12px auto; border: 1px solid var(--border-color);">
                    <label for="story-file-input" style="display: inline-block; padding: 10px 20px; background: rgba(255,203,5,0.15); border: 1.5px solid var(--accent-gold); color: var(--accent-gold); font-weight: 700; border-radius: 10px; cursor: pointer; font-size: 0.88rem;">📁 Choose Photo from Device</label>
                    <input type="file" id="story-file-input" accept="image/*" style="display: none;">
                </div>
                <input type="text" id="story-caption-input" placeholder="Write a story caption or note..." style="width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 16px; font-size: 0.9rem;">
                <div style="display: flex; gap: 10px;">
                    <button id="cancel-add-story-btn" style="flex: 1; padding: 10px; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 10px; cursor: pointer;">Cancel</button>
                    <button id="submit-share-story-btn" class="btn-primary" style="flex: 1; padding: 10px;">Share Story ✨</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.cssText = 'display: flex !important; z-index: 999999;';
    setupAddStoryModal();
};

window.openNoteModal = function() {
    const currentNote = prompt("Update your 24-hour Status Note (max 60 chars):");
    if (currentNote !== null) {
        fetch(`${API_BASE}/users/note`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text: currentNote })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                myUser.note = data.note;
                localStorage.setItem('user', JSON.stringify(myUser));
                showSpotliteToast('✨ Note updated!');
                if (typeof loadStoriesBar === 'function') loadStoriesBar();
            }
        })
        .catch(() => alert('Failed to update note'));
    }
};

window.openGroupChatModal = function() {
    let modal = document.getElementById('group-chat-modal-overlay') || document.getElementById('group-chat-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'group-chat-modal-overlay';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex !important; z-index: 999999;';
        modal.innerHTML = `
            <div style="position: relative; max-width: 440px; width: 90%; background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: 20px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: var(--accent-gold); font-size: 1.1rem; font-weight: 700;">👥 Create Group Chat</h3>
                    <button id="close-group-modal-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <input type="text" id="group-name-input" placeholder="Group Name..." style="width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 14px; font-size: 0.9rem;">
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">Select Group Members:</p>
                <div id="group-users-selection-list" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    <p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">Loading users...</p>
                </div>
                <button id="create-group-submit-btn" class="btn-primary" style="width: 100%; padding: 10px;">Create Group ✨</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#close-group-modal-btn').onclick = () => {
            modal.style.cssText = 'display: none !important;';
            modal.classList.remove('active');
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.cssText = 'display: none !important;';
                modal.classList.remove('active');
            }
        };

        modal.querySelector('#create-group-submit-btn').onclick = async () => {
            const groupName = modal.querySelector('#group-name-input').value.trim();
            const checkedBoxes = modal.querySelectorAll('.group-user-checkbox:checked');
            const selectedMemberIds = Array.from(checkedBoxes).map(cb => cb.value);

            if (!groupName) {
                alert('Please enter a group name.');
                return;
            }
            if (selectedMemberIds.length === 0) {
                alert('Please select at least one group member.');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/messages`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        receiverId: selectedMemberIds[0],
                        text: `👥 Group "${groupName}" created with ${selectedMemberIds.length + 1} members!`
                    })
                });
                if (res.ok) {
                    modal.style.cssText = 'display: none !important;';
                    modal.classList.remove('active');
                    if (typeof showSpotliteToast === 'function') showSpotliteToast(`✨ Group "${groupName}" created!`);
                    else alert(`Group "${groupName}" created!`);
                    if (typeof loadConversationsInbox === 'function') loadConversationsInbox();
                }
            } catch (e) {
                alert('Failed to create group');
            }
        };
    }

    modal.style.cssText = 'display: flex !important; z-index: 999999;';
    modal.classList.add('active');

    const userListContainer = modal.querySelector('#group-users-selection-list');
    if (userListContainer) {
        fetch(`${API_BASE}/users`, { headers: getHeaders() })
            .then(res => res.json())
            .then(data => {
                const users = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const myId = currentUser.id || currentUser._id;
                const filtered = users.filter(u => u._id !== myId && u.id !== myId);

                if (filtered.length === 0) {
                    userListContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No users available.</p>';
                    return;
                }
                userListContainer.innerHTML = '';
                filtered.forEach(u => {
                    const label = document.createElement('label');
                    label.style.cssText = 'display:flex; align-items:center; gap:10px; padding:6px 10px; background:var(--bg-input); border-radius:8px; cursor:pointer; font-size:0.88rem;';
                    label.innerHTML = `
                        <input type="checkbox" class="group-user-checkbox" value="${u._id}" style="accent-color:var(--accent-gold);">
                        <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
                        <span>@${escapeHtml(u.username)}</span>
                    `;
                    userListContainer.appendChild(label);
                });
            })
            .catch(() => {
                userListContainer.innerHTML = '<p style="color:var(--accent-red); text-align:center;">Failed to load users.</p>';
            });
    }
};

function setupGroupChatModal() {
    const btn = document.getElementById('inbox-new-group-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            window.openGroupChatModal();
        };
    }
}

window.openNewChatPanel = function() {
    let modal = document.getElementById('new-chat-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'new-chat-modal-overlay';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex !important; z-index: 999999;';
        modal.innerHTML = `
            <div style="position: relative; max-width: 440px; width: 90%; background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: 20px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                    <h3 style="margin: 0; color: var(--accent-gold); font-size: 1.1rem; font-weight: 700;">💬 Send New Message</h3>
                    <button id="close-new-chat-modal-btn" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <input type="text" id="new-chat-user-search" placeholder="🔍 Search user by username..." style="width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); margin-bottom: 14px; font-size: 0.9rem; outline: none;">
                <div id="new-chat-users-results" style="max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    <p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">Loading users...</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#close-new-chat-modal-btn').onclick = () => modal.style.cssText = 'display: none !important;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.cssText = 'display: none !important;'; };
    }

    modal.style.cssText = 'display: flex !important; z-index: 999999;';
    
    const searchInput = modal.querySelector('#new-chat-user-search');
    const resultsContainer = modal.querySelector('#new-chat-users-results');

    const renderUsersList = (searchQuery = '') => {
        resultsContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">Searching users...</p>';
        const url = searchQuery.trim() 
            ? `${API_BASE}/users/search?q=${encodeURIComponent(searchQuery.trim())}`
            : `${API_BASE}/users`;

        fetch(url, { headers: getHeaders() })
            .then(res => res.json())
            .then(data => {
                const users = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const myId = currentUser.id || currentUser._id;
                const filtered = users.filter(u => (u._id !== myId && u.id !== myId));

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">No users found.</p>';
                    return;
                }

                resultsContainer.innerHTML = '';
                filtered.forEach(u => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-input); border-radius: 10px; cursor: pointer; transition: background 0.2s;';
                    row.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">
                            <div>
                                <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); display: block;">@${escapeHtml(u.username)}</span>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(u.bio || 'Spotlite user')}</span>
                            </div>
                        </div>
                        <button class="btn-primary" style="padding: 4px 12px; font-size: 0.8rem;">Chat 💬</button>
                    `;
                    row.onclick = () => {
                        modal.style.cssText = 'display: none !important;';
                        if (typeof openChatWithUser === 'function') {
                            openChatWithUser(u);
                        } else {
                            window.location.href = `messages.html?u=${u.username}`;
                        }
                    };
                    resultsContainer.appendChild(row);
                });
            })
            .catch(() => {
                resultsContainer.innerHTML = '<p style="color:var(--accent-red); text-align:center;">Failed to load users.</p>';
            });
    };

    renderUsersList('');
    searchInput.oninput = () => renderUsersList(searchInput.value);
};

function setupAddStoryModal() {
    const modal = document.getElementById('add-story-modal-overlay');
    const closeBtn = document.getElementById('close-add-story-modal-btn');
    const cancelBtn = document.getElementById('cancel-add-story-btn');
    const submitBtn = document.getElementById('submit-share-story-btn');
    const fileInput = document.getElementById('story-file-input');
    const previewImg = document.getElementById('story-media-preview');
    const captionInput = document.getElementById('story-caption-input');

    if (!modal) return;

    let pendingStoryImage = '';

    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            compressImage(file, 1080, 1080, 0.75).then(base64 => {
                pendingStoryImage = base64;
                if (previewImg) {
                    previewImg.src = pendingStoryImage;
                    previewImg.style.display = 'block';
                }
            }).catch(() => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    pendingStoryImage = evt.target.result;
                    if (previewImg) {
                        previewImg.src = pendingStoryImage;
                        previewImg.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            });
        };
    }

    const hide = () => {
        modal.style.display = 'none';
        modal.classList.remove('active');
        pendingStoryImage = '';
        if (previewImg) previewImg.style.display = 'none';
        if (captionInput) captionInput.value = '';
        if (fileInput) fileInput.value = '';
    };

    if (closeBtn) closeBtn.onclick = hide;
    if (cancelBtn) cancelBtn.onclick = hide;

    if (submitBtn) {
        submitBtn.onclick = async () => {
            const caption = captionInput ? captionInput.value.trim() : '';
            if (!pendingStoryImage && !caption) {
                alert('Please choose a photo or write a caption for your story.');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';

                const res = await fetch(`${API_BASE}/stories`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        image: pendingStoryImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                        caption
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to add story');

                hide();
                showSpotliteToast('Added to your story! 📸✨');
                if (typeof loadStoriesBar === 'function') loadStoriesBar();
            } catch (err) {
                alert(err.message || 'Failed to add story');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Share Story ✨';
            }
        };
    }
}

// Load real dynamic user stories bar
window.loadStories = async function() {
    const storiesContainer = document.getElementById('stories-container');
    if (!storiesContainer) return;

    setupAddStoryModal();

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userAvatar = currentUser && currentUser.avatar 
        ? currentUser.avatar 
        : `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser ? currentUser.username : 'me'}`;
    const userNoteText = currentUser.note ? currentUser.note.text : '';

    try {
        const response = await fetch(`${API_BASE}/users/stories`, { headers: getHeaders() });
        const stories = await response.json();
        
        const storyGroupMap = new Map();
        if (Array.isArray(stories)) {
            stories.forEach(s => {
                const u = s.author;
                if (!u) return;
                const authorId = String(u._id || u.id || u);
                if (!storyGroupMap.has(authorId)) {
                    storyGroupMap.set(authorId, { author: u, stories: [] });
                }
                storyGroupMap.get(authorId).stories.push(s);
            });
        }

        const myId = String(currentUser._id || currentUser.id || '');
        const myGroup = storyGroupMap.get(myId);
        const myStories = myGroup ? myGroup.stories : [];

        let html = `
            <div class="story-item" id="user-note-trigger" style="position: relative; cursor: pointer;" onclick="openAddStoryModal()" title="Click to Add Instagram Story">
                ${userNoteText ? `<div class="story-note-bubble" onclick="event.stopPropagation(); openNoteModal();">${escapeHtml(userNoteText)}</div>` : `<div class="story-note-bubble" onclick="event.stopPropagation(); openNoteModal();">+ Note...</div>`}
                <div class="story-avatar-wrapper user-story-add" style="border: 2.5px solid ${myStories.length > 0 ? 'var(--accent-gold)' : 'var(--border-color)'};">
                    <img src="${userAvatar}" class="story-avatar-img" alt="Your story">
                    <div class="add-story-badge">+</div>
                </div>
                <span class="story-username" style="color: var(--accent-gold); font-weight: 700;">Your story</span>
            </div>
        `;

        storyGroupMap.forEach((group, authorId) => {
            if (authorId === myId) return;
            const u = group.author || {};
            const uAvatar = u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`;
            const noteText = group.stories[0]?.caption || (u.note ? u.note.text : '');

            html += `
                <div class="story-item" style="position: relative; cursor: pointer;" onclick="openStoryGroupViewer('${authorId}')">
                    ${noteText ? `<div class="story-note-bubble">${escapeHtml(noteText)}</div>` : ''}
                    <div class="story-avatar-wrapper" style="border: 3px solid var(--accent-gold); box-shadow: 0 0 10px rgba(255,203,5,0.5);">
                        <img src="${uAvatar}" class="story-avatar-img" alt="${u.username}">
                    </div>
                    <span class="story-username">@${escapeHtml(u.username || 'user')}</span>
                </div>
            `;
        });

        window._homeStoryGroups = storyGroupMap;
        storiesContainer.innerHTML = html;
    } catch (e) {
        console.error('Stories load error:', e);
    }
};

function setupCategoryFilterBar() {
    const filterBar = document.getElementById('category-filter-bar');
    if (!filterBar) return;

    const pills = filterBar.querySelectorAll('.mood-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeCategoryFilter = pill.getAttribute('data-category') || 'all';
            loadFeedPosts();
        });
    });
}

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

        const postsData = await response.json();
        if (!response.ok) throw new Error(postsData.error || 'Failed to load posts');

        let filteredPosts = Array.isArray(postsData) ? postsData : (postsData && Array.isArray(postsData.posts) ? postsData.posts : []);

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

// Helper to render color-coded category badges on post headers
function getCategoryBadgeHTML(category) {
    if (!category) return '';
    const cat = category.toLowerCase();
    let badgeClass = 'cat-general';
    let icon = '🌟';

    if (cat.includes('funny') || cat.includes('meme')) { badgeClass = 'cat-funny'; icon = '😂'; }
    else if (cat.includes('anime') || cat.includes('manga')) { badgeClass = 'cat-anime'; icon = '🎌'; }
    else if (cat.includes('movie') || cat.includes('tv') || cat.includes('cinema')) { badgeClass = 'cat-movies'; icon = '🎬'; }
    else if (cat.includes('news') || cat.includes('national')) { badgeClass = 'cat-news'; icon = '📰'; }
    else if (cat.includes('study') || cat.includes('education') || cat.includes('learn')) { badgeClass = 'cat-study'; icon = '📚'; }
    else if (cat.includes('travel') || cat.includes('trip') || cat.includes('lifestyle')) { badgeClass = 'cat-travel'; icon = '✈️'; }
    else if (cat.includes('food') || cat.includes('cook') || cat.includes('recipe')) { badgeClass = 'cat-food'; icon = '🍔'; }
    else if (cat.includes('fitness') || cat.includes('health') || cat.includes('gym')) { badgeClass = 'cat-fitness'; icon = '🏋️'; }
    else if (cat.includes('tech') || cat.includes('code') || cat.includes('dev')) { badgeClass = 'cat-tech'; icon = '💻'; }
    else if (cat.includes('gaming') || cat.includes('game')) { badgeClass = 'cat-gaming'; icon = '🎮'; }
    else if (cat.includes('music') || cat.includes('song')) { badgeClass = 'cat-music'; icon = '🎵'; }
    else if (cat.includes('art') || cat.includes('design')) { badgeClass = 'cat-art'; icon = '🎨'; }
    else if (cat.includes('happy') || cat.includes('joy')) { badgeClass = 'cat-happy'; icon = '😊'; }

    return `<span class="post-category-badge ${badgeClass}">${icon} ${escapeHtml(category)}</span>`;
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

    // Repost preview HTML
    let repostHTML = '';
    if (post.repostOf) {
        const repAuthor = post.repostOf.author ? post.repostOf.author.username : 'Someone';
        const repAvatar = (post.repostOf.author && post.repostOf.author.avatar) ? post.repostOf.author.avatar : `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${repAuthor}`;
        repostHTML = `
            <div class="repost-wrapper">
                ${post.repostComment ? `<p class="repost-comment-text">💭 "${escapeHtml(post.repostComment)}"</p>` : ''}
                <div class="repost-author-bar">
                    <img src="${repAvatar}" class="repost-author-avatar">
                    <span>Reposted from @${escapeHtml(repAuthor)}</span>
                </div>
            </div>
        `;
    }

    // Poll HTML
    let pollHTML = '';
    if (post.poll && post.poll.question && post.poll.options && post.poll.options.length > 0) {
        let totalVotes = 0;
        post.poll.options.forEach(o => totalVotes += (o.votes ? o.votes.length : 0));
        const optionsHTML = post.poll.options.map((opt, idx) => {
            const votes = opt.votes ? opt.votes.length : 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            return `
                <div class="poll-option-btn" onclick="votePollOption('${post._id}', ${idx})">
                    <div class="poll-progress-fill" style="width: ${pct}%;"></div>
                    <span class="poll-option-text">${escapeHtml(opt.text)}</span>
                    <span class="poll-option-pct">${pct}%</span>
                </div>
            `;
        }).join('');

        pollHTML = `
            <div class="post-poll-container">
                <div class="poll-question">📊 ${escapeHtml(post.poll.question)}</div>
                ${optionsHTML}
                <div class="poll-total-votes">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</div>
            </div>
        `;
    }

    const authorObj = (post.author && typeof post.author === 'object') ? post.author : { username: 'spotlite_user', avatar: '' };
    const authorUsername = authorObj.username || 'spotlite_user';
    const authorAvatar = authorObj.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${authorUsername}`;

    card.innerHTML = `
        <!-- Post Header -->
        <div class="post-header">
            <div class="post-author-info" onclick="window.location.href='profile.html?u=${encodeURIComponent(authorUsername)}'">
                <div class="post-avatar-ring">
                    <img src="${authorAvatar}" alt="Avatar" class="post-avatar">
                </div>
                <div class="post-header-meta">
                    <span class="post-username" style="display: inline-flex; align-items: center; gap: 6px;">
                        ${escapeHtml(authorUsername)}
                        ${getCategoryBadgeHTML(post.category)}
                        ${post.isPinned ? '<span class="pin-indicator" title="Pinned Post" style="margin-left: 4px; color: var(--accent-gold); font-size: 0.8rem;">📌</span>' : ''}
                    </span>
                    <span class="post-time-sub">
                        ${formatTime(post.createdAt)}
                        ${post.location ? `<span style="color:var(--accent-gold);margin-left:6px;font-weight:600;">📍 ${escapeHtml(post.location)}</span>` : ''}
                    </span>
                </div>
            </div>
            <button class="post-menu-btn" title="More options">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            </button>
        </div>

        ${repostHTML}
        ${pollHTML}

        <!-- Post Image -->
        ${(post.image && post.image.trim()) ? `
        <div class="post-image-container" style="position: relative;">
            ${post.mood ? `<span class="post-mood-overlay-tag">${escapeHtml(post.mood)}</span>` : ''}
            <img src="${post.image}" alt="Post image" class="post-image" style="${post.filter && post.filter !== 'none' ? `filter: ${post.filter};` : ''}">
            <span class="like-heart-pop">❤️</span>
        </div>
        ` : ''}

        <!-- Action Bar -->
        <div class="post-actions">
            <div class="post-actions-left">
                <!-- Like -->
                <button class="action-btn ${isLiked ? 'liked' : ''}" id="like-btn-${post._id}" title="Like">
                    <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <span class="action-count" id="likes-count-${post._id}">${post.likes ? post.likes.length : 0}</span>
                </button>
                <!-- Comment -->
                <button class="action-btn" id="comment-btn-${post._id}" title="Comment">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="action-count">${post.comments ? post.comments.length : 0}</span>
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
            ${post.mood ? `<span class="post-mood-tag">${escapeHtml(post.mood)}</span>` : ''}
            <span class="caption-username" onclick="window.location.href='profile.html?u=${encodeURIComponent(authorUsername)}'">${escapeHtml(authorUsername)}</span>
            <span class="caption-text" id="caption-text-${post._id}">${captionShort}</span>
            ${hasTruncation ? `<button class="caption-more-btn" data-full="${encodeURIComponent(caption)}" data-post="${post._id}">more</button>` : ''}
        </div>

        ${post.comments.length > 0 ? `
        <button class="comments-preview-btn" onclick="openPostDetailModal('${post._id}')">View all ${post.comments.length} comment${post.comments.length !== 1 ? 's' : ''}</button>
        ` : ''}

        <!-- Quick Emoji & AI Comment Suggestion Pills -->
        <div class="comment-emoji-bar">
            <span class="emoji-reaction-pill" data-emoji="❤️">❤️</span>
            <span class="emoji-reaction-pill" data-emoji="🔥">🔥</span>
            <span class="emoji-reaction-pill" data-emoji="👏">👏</span>
            <span class="emoji-reaction-pill ai-suggest-pill" data-text="Love this ❤️">Love this ❤️</span>
            <span class="emoji-reaction-pill ai-suggest-pill" data-text="Awesome work 👏">Awesome work 👏</span>
            <span class="emoji-reaction-pill ai-suggest-pill" data-text="Great shot 📷">Great shot 📷</span>
        </div>

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

    // Inline Comment Submit Function
    async function submitInlineComment() {
        if (!commentInput) return;
        const text = commentInput.value.trim();
        if (!text) return;
        try {
            if (commentSubmit) commentSubmit.disabled = true;
            const res = await fetch(`${API_BASE}/posts/${post._id}/comment`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to post comment');
            
            commentInput.value = '';
            if (commentSubmit) commentSubmit.classList.remove('active');
            showSpotliteToast('Comment posted! 💬');
            
            const commentsArr = Array.isArray(data) ? data : (data.comments || []);
            const newCount = commentsArr.length;
            const countSpan = card.querySelector(`#comment-btn-${post._id} .action-count`);
            if (countSpan) countSpan.textContent = newCount;
            
            let previewBtn = card.querySelector('.comments-preview-btn');
            if (previewBtn) {
                previewBtn.textContent = `View all ${newCount} comment${newCount !== 1 ? 's' : ''}`;
            } else if (newCount > 0) {
                const wrapper = card.querySelector('.comment-input-wrapper');
                if (wrapper) {
                    previewBtn = document.createElement('button');
                    previewBtn.className = 'comments-preview-btn';
                    previewBtn.onclick = () => openPostDetailModal(post._id);
                    previewBtn.textContent = `View all ${newCount} comment${newCount !== 1 ? 's' : ''}`;
                    wrapper.parentNode.insertBefore(previewBtn, wrapper);
                }
            }

            if (typeof playActionSound === 'function') playActionSound('comment');
        } catch (err) {
            alert(err.message || 'Failed to post comment');
        } finally {
            if (commentSubmit) commentSubmit.disabled = false;
        }
    }

    if (commentSubmit) commentSubmit.addEventListener('click', submitInlineComment);
    if (commentInput) {
        commentInput.addEventListener('input', () => {
            if (commentSubmit) commentSubmit.classList.toggle('active', commentInput.value.trim() !== '');
        });
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitInlineComment();
            }
        });
    }

    // Caption "more" toggle
    const moreBtn = card.querySelector('.caption-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            card.querySelector(`#caption-text-${post._id}`).textContent = decodeURIComponent(moreBtn.dataset.full);
            moreBtn.remove();
        });
    }

    // Like Toggle with Optimistic UI & Smooth Reaction
    async function toggleLike() {
        const isLikedCurrently = likeBtn.classList.contains('liked');
        const currentCount = parseInt(likesCount.textContent || '0', 10);
        const newLiked = !isLikedCurrently;
        const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

        // 1. Instant 0ms Optimistic UI Update & Spring Scale Animation
        likeBtn.classList.toggle('liked', newLiked);
        likesCount.textContent = newCount;
        likeBtn.style.transform = 'scale(1.35)';
        setTimeout(() => { likeBtn.style.transform = 'scale(1)'; }, 150);
        if (newLiked) playActionSound('like');

        try {
            const response = await fetch(`${API_BASE}/posts/${post._id}/like`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            // Sync with authoritative server response
            const serverLiked = data.liked !== undefined ? data.liked : (data.isLiked !== undefined ? data.isLiked : newLiked);
            const serverCount = data.likesCount !== undefined ? data.likesCount : (data.likes ? data.likes.length : newCount);
            likeBtn.classList.toggle('liked', serverLiked);
            likesCount.textContent = serverCount;
        } catch (err) {
            console.error('Like error:', err);
            // Revert state on error
            likeBtn.classList.toggle('liked', isLikedCurrently);
            likesCount.textContent = currentCount;
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

    // Share / Copy Link trigger
    if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const postUrl = `${window.location.origin}/index.html#post-${post._id}`;
            navigator.clipboard.writeText(postUrl).then(() => {
                showSpotliteToast('Post link copied to clipboard! 📋✨');
            }).catch(() => {
                showSpotliteToast('Sharing post spotlite... ✨');
            });
        });
    }

    // Quick Emoji & AI Pills Click Handler
    const emojiPills = card.querySelectorAll('.emoji-reaction-pill');
    emojiPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const emoji = pill.getAttribute('data-emoji');
            const aiText = pill.getAttribute('data-text');
            if (commentInput) {
                if (aiText) {
                    commentInput.value = aiText;
                } else {
                    const currentVal = commentInput.value.trim();
                    commentInput.value = currentVal ? `${currentVal} ${emoji}` : emoji;
                }
                commentInput.focus();
                if (commentSubmit) commentSubmit.classList.add('active');
            }
        });
    });

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
                showSpotliteToast('Saved to your bookmarks! 🔖');
            } else {
                if (window.savedPostIdsSet) window.savedPostIdsSet.delete(post._id);
                showSpotliteToast('Removed from bookmarks');
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
    const container = document.getElementById('suggestions-container') || document.getElementById('suggestions-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Failed to fetch suggestions');

        const usersList = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;

        // Exclude self from suggestions list
        const filteredUsers = usersList.filter(u => u._id !== currentUserId && u.id !== currentUserId);

        if (filteredUsers.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 6px 0;">No suggestions available</p>`;
            return;
        }

        container.innerHTML = '';

        filteredUsers.slice(0, 5).forEach(user => {
            const isFollowing = currentUser && currentUser.following && currentUser.following.includes(user._id);
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.marginBottom = '10px';

            row.innerHTML = `
                <div class="user-profile-card" style="margin: 0; padding: 0; background: none; box-shadow: none;">
                    <div class="user-card-info" style="cursor: pointer;" onclick="window.location.href='profile.html?u=${user.username}'">
                        <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="Avatar" class="user-card-avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                        <div class="user-card-names" style="margin-left: 10px;">
                            <span class="user-card-username" style="font-size: 0.88rem; font-weight: 600; display: block;">${user.username}</span>
                            <span class="user-card-fullname" style="font-size: 0.76rem; color: var(--text-muted);">Suggested for you</span>
                        </div>
                    </div>
                </div>
                <button class="follow-btn" id="suggest-follow-${user._id}" style="background: none; border: none; color: ${isFollowing ? 'var(--text-secondary)' : 'var(--accent-blue)'}; font-weight: 600; font-size: 0.82rem; cursor: pointer;">${isFollowing ? 'Following' : 'Follow'}</button>
            `;

            container.appendChild(row);

            // Hook follow toggle
            const followBtn = row.querySelector(`#suggest-follow-${user._id}`);
            if (followBtn) {
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
            }
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
        const response = await fetch(`${API_BASE}/users/all`, { headers: getHeaders() });
        const users = await response.json();
        if (!response.ok || !Array.isArray(users)) {
            container.style.display = 'none';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user'));
        container.innerHTML = '';

        // Always show logged-in user's own story bubble with note trigger first
        if (currentUser) {
            const myNoteText = currentUser.note ? currentUser.note.text : '';
            const myBubble = document.createElement('div');
            myBubble.className = 'story-item';
            myBubble.style.position = 'relative';
            myBubble.title = 'Click note bubble to edit note';
            myBubble.innerHTML = `
                ${myNoteText 
                    ? `<div class="story-note-bubble" onclick="event.stopPropagation(); openNoteModal();">${escapeHtml(myNoteText)}</div>` 
                    : `<div class="story-note-bubble" onclick="event.stopPropagation(); openNoteModal();">+ Note...</div>`}
                <div class="story-avatar-wrapper story-avatar-wrapper--own" onclick="window.location.href='profile.html?u=${currentUser.username}'">
                    <img src="${currentUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser.username}`}" alt="Your story" class="story-avatar">
                </div>
                <span class="story-username" style="color: var(--accent-gold); font-weight: 700;">You</span>
            `;
            container.appendChild(myBubble);
        }

        // Add other users (exclude self)
        users
            .filter(u => !currentUser || u.username !== currentUser.username)
            .slice(0, 15)
            .forEach(user => {
                const userNoteText = user.note ? user.note.text : '';
                const item = document.createElement('div');
                item.className = 'story-item';
                item.style.position = 'relative';
                item.onclick = () => window.location.href = `profile.html?u=${user.username}`;
                item.innerHTML = `
                    ${userNoteText ? `<div class="story-note-bubble">${escapeHtml(userNoteText)}</div>` : ''}
                    <div class="story-avatar-wrapper">
                        <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="${user.username}" class="story-avatar">
                    </div>
                    <span class="story-username">${escapeHtml(user.username)}</span>
                `;
                container.appendChild(item);
            });

        if (container.children.length === 0) container.style.display = 'none';
        else container.style.display = 'flex';
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

// =============================================================
// PROFILE PAGE LOGIC (profile.html)
// =============================================================
async function initProfilePage() {
    setupNavigationLinks();
    const params = new URLSearchParams(window.location.search);
    let username = params.get('u');
    const currentUser = JSON.parse(localStorage.getItem('user'));

    if (!username && currentUser) {
        username = currentUser.username;
    }

    if (!username) {
        window.location.href = 'auth.html';
        return;
    }

    await loadProfileHeader(username);
    await loadProfileGrid(username);
    setupEditProfileModal();
}

function setupEditProfileModal() {
    const editBtn = document.getElementById('open-edit-profile-btn');
    const modal = document.getElementById('edit-profile-modal-overlay');
    const closeBtn = document.getElementById('close-edit-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');
    const coverUrlInput = document.getElementById('edit-cover-photo-url');
    const coverFileInput = document.getElementById('edit-cover-file-input');
    const avatarUrlInput = document.getElementById('edit-avatar-url');
    const avatarFileInput = document.getElementById('edit-avatar-file-input');
    const bioInput = document.getElementById('edit-bio');
    const bioLinkInput = document.getElementById('edit-bio-link');

    if (!modal) return;

    if (editBtn) {
        editBtn.onclick = () => {
            modal.style.display = 'flex';
            if (currentProfileUser) {
                if (bioInput) bioInput.value = currentProfileUser.bio || '';
                if (bioLinkInput) bioLinkInput.value = currentProfileUser.bioLink || currentProfileUser.website || '';
                if (avatarUrlInput) avatarUrlInput.value = currentProfileUser.avatar || '';
                if (coverUrlInput) coverUrlInput.value = currentProfileUser.coverPhoto || '';
            }
        };
    }

    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

    if (coverFileInput && coverUrlInput) {
        coverFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                coverUrlInput.value = evt.target.result;
            };
            reader.readAsDataURL(file);
        };
    }

    if (avatarFileInput && avatarUrlInput) {
        avatarFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                avatarUrlInput.value = evt.target.result;
                const preview = document.getElementById('edit-avatar-preview');
                if (preview) preview.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        };
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            try {
                const bio = bioInput ? bioInput.value.trim() : '';
                const website = bioLinkInput ? bioLinkInput.value.trim() : '';
                const avatar = avatarUrlInput ? avatarUrlInput.value.trim() : '';
                const coverPhoto = coverUrlInput ? coverUrlInput.value.trim() : '';

                const res = await fetch(`${API_BASE}/users/profile`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ bio, website, avatar, coverPhoto })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update profile');

                // Update local user in localStorage
                const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = { ...myUser, avatar: avatar || myUser.avatar, coverPhoto: coverPhoto || myUser.coverPhoto, bio: bio || myUser.bio, website: website || myUser.website };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                modal.style.display = 'none';
                showSpotliteToast('✨ Profile updated!');

                if (window.location.pathname.includes('profile.html')) {
                    const params = new URLSearchParams(window.location.search);
                    const usernameParam = params.get('u') || updatedUser.username;
                    if (usernameParam && typeof loadProfileHeader === 'function') {
                        await loadProfileHeader(usernameParam);
                    } else {
                        window.location.reload();
                    }
                } else {
                    window.location.reload();
                }
            } catch (err) {
                alert(err.message || 'Failed to update profile.');
            }
        };
    }
}

// Loads profile header details
async function loadProfileHeader(username) {
    try {
        const response = await fetch(`${API_BASE}/users/profile/${username}`, {
            headers: getHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Profile not found.');

        const u = data.user || data;
        profileUserObjectId = u._id || u.id;
        currentProfileUser = u;
        applyThemeClass(u.profileTheme);

        // Update local user storage if updating own profile
        const myUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (myUser && (myUser.username === u.username || myUser.id === (u._id || u.id))) {
            myUser.avatar = u.avatar;
            myUser.coverPhoto = u.coverPhoto;
            myUser.bio = u.bio;
            myUser.website = u.website;
            localStorage.setItem('user', JSON.stringify(myUser));
        }

        // Render Cover Banner (Image or Video)
        const bannerContainer = document.getElementById('profile-cover-media-container');
        if (bannerContainer) {
            if (u.coverPhoto) {
                const url = u.coverPhoto.trim();
                const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.startsWith('data:video/');
                if (isVideo) {
                    bannerContainer.innerHTML = `<video src="${url}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`;
                } else {
                    bannerContainer.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" alt="Cover Banner">`;
                }
            } else {
                bannerContainer.innerHTML = '';
            }
        }

        // Populate elements
        const avatarEl = document.getElementById('profile-user-avatar');
        if (avatarEl) avatarEl.src = u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`;

        const usernameHeading = document.getElementById('profile-username-heading');
        if (usernameHeading) usernameHeading.textContent = u.username;

        const fullnameEl = document.getElementById('profile-fullname');
        if (fullnameEl) fullnameEl.textContent = u.username;

        const bioTextEl = document.getElementById('profile-bio-text');
        if (bioTextEl) bioTextEl.textContent = u.bio || 'No bio description.';

        // Animate stats
        animateNumber('profile-followers-count', data.followersCount || (u.followers ? u.followers.length : 0));
        animateNumber('profile-following-count', data.followingCount || (u.following ? u.following.length : 0));

        // Render badges
        renderProfileBadges(u);

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
        const profileLogoutBtn = document.getElementById('profile-logout-btn');
        if (currentUser && currentUser.username === username.toLowerCase()) {
            // OWN profile – show edit button & logout button
            editBtn.style.display = 'inline-block';
            if (profileLogoutBtn) {
                profileLogoutBtn.style.display = 'inline-block';
                profileLogoutBtn.onclick = () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'auth.html';
                };
            }
            optionsBtn.style.display = 'none';
            actionsRow.style.display = 'none';
            if (tabSavedBtn) tabSavedBtn.style.display = 'flex';
        } else {
            // OTHER profile – show actions row & options
            editBtn.style.display = 'none';
            if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
            optionsBtn.style.display = 'flex';
            actionsRow.style.display = 'flex';
            if (tabSavedBtn) tabSavedBtn.style.display = 'none';

            if (messageBtn) {
                messageBtn.onclick = () => {
                    window.location.href = `messages.html?u=${encodeURIComponent(data.username)}`;
                };
            }

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

// Load Saved Posts Grid
async function loadProfileSavedGrid() {
    const grid = document.getElementById('profile-saved-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1; padding: 40px 0;">Loading saved posts...</p>';
        const res = await fetch(`${API_BASE}/posts/saved`, { headers: getHeaders() });
        const posts = await res.json();
        if (!res.ok) throw new Error(posts.error);

        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 0; width: 100%; grid-column: 1/-1;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--text-secondary)" stroke-width="1.5" fill="none" style="margin-bottom: 12px;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    <h3>No Saved Posts Yet</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">Save posts to easily view them here later.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'grid-post-item';
            item.innerHTML = `
                <img src="${post.image}" alt="Saved post" class="grid-post-img">
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
            item.addEventListener('click', () => openPostDetailModal(post._id));
            grid.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading saved grid:', err);
        grid.innerHTML = '<p style="color:var(--accent-red); text-align:center; grid-column:1/-1;">Failed to load saved posts.</p>';
    }
}

// Load Liked Posts Grid
async function loadProfileLikedGrid() {
    const grid = document.getElementById('profile-posts-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1; padding: 40px 0;">Loading liked posts...</p>';
        const res = await fetch(`${API_BASE}/posts/feed`, { headers: getHeaders() });
        const data = await res.json();
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = currentUser.id || currentUser._id;
        
        let allPosts = Array.isArray(data) ? data : (data.posts || []);
        const likedPosts = allPosts.filter(p => p.likes && p.likes.some(l => (l._id || l) === currentUserId));

        if (likedPosts.length === 0) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 0; width: 100%; grid-column: 1/-1;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--text-secondary)" style="margin-bottom: 12px;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <h3>No Liked Posts Yet</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">Posts you like will be displayed here.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        likedPosts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'grid-post-item';
            item.innerHTML = `
                <img src="${post.image}" alt="Liked post" class="grid-post-img">
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
            item.addEventListener('click', () => openPostDetailModal(post._id));
            grid.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading liked grid:', err);
    }
}

function setupProfileTabs() {
    const postsBtn = document.getElementById('tab-posts-btn');
    const devBtn = document.getElementById('tab-dev-info-btn');
    const qaBtn = document.getElementById('tab-qa-btn');
    const savedBtn = document.getElementById('tab-saved-btn');
    const likedBtn = document.getElementById('tab-liked-btn');

    const postsGrid = document.getElementById('profile-posts-grid');
    const savedGrid = document.getElementById('profile-saved-grid');
    const devContainer = document.getElementById('profile-dev-container');
    const qaContainer = document.getElementById('profile-qa-container');
    const controlsBar = document.getElementById('profile-post-controls-bar');

    function setActiveTab(activeBtn, targetView) {
        [postsBtn, devBtn, qaBtn, savedBtn, likedBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (activeBtn) activeBtn.classList.add('active');

        if (postsGrid) postsGrid.style.display = 'none';
        if (savedGrid) savedGrid.style.display = 'none';
        if (devContainer) devContainer.style.display = 'none';
        if (qaContainer) qaContainer.style.display = 'none';
        if (controlsBar) controlsBar.style.display = 'none';

        if (targetView === 'posts') {
            if (postsGrid) postsGrid.style.display = 'grid';
            if (controlsBar) controlsBar.style.display = 'flex';
        } else if (targetView === 'saved') {
            if (savedGrid) savedGrid.style.display = 'grid';
            loadProfileSavedGrid();
        } else if (targetView === 'liked') {
            if (postsGrid) postsGrid.style.display = 'grid';
            loadProfileLikedGrid();
        } else if (targetView === 'dev') {
            if (devContainer) devContainer.style.display = 'block';
        } else if (targetView === 'qa') {
            if (qaContainer) qaContainer.style.display = 'block';
        }
    }

    if (postsBtn) postsBtn.onclick = () => setActiveTab(postsBtn, 'posts');
    if (devBtn) devBtn.onclick = () => setActiveTab(devBtn, 'dev');
    if (qaBtn) qaBtn.onclick = () => setActiveTab(qaBtn, 'qa');
    if (savedBtn) savedBtn.onclick = () => setActiveTab(savedBtn, 'saved');
    if (likedBtn) likedBtn.onclick = () => setActiveTab(likedBtn, 'liked');
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

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const cancelBtn = document.getElementById('cancel-edit-profile-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

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
    const catBadge = document.getElementById('detail-post-category-badge');
    const commentsList = document.getElementById('detail-comments-list');
    const likesCount = document.getElementById('detail-likes-count');
    const likeBtn = document.getElementById('detail-like-btn');
    const authorNav = document.getElementById('detail-author-nav');
    const commentInput = document.getElementById('detail-comment-input');
    const commentSubmit = document.getElementById('detail-comment-submit-btn');
    const shareBtn = document.getElementById('detail-share-btn');

    if (commentsList) {
        commentsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Loading post details...</p>';
    }

    try {
        const response = await fetch(`${API_BASE}/posts/${postId}`, { headers: getHeaders() });
        const targetPost = await response.json();
        if (!response.ok) throw new Error(targetPost.error || 'Post not found');

        // Populate header & media
        if (detailImage) detailImage.src = targetPost.image;
        if (detailAvatar) {
            detailAvatar.src = targetPost.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${targetPost.author.username}`;
            detailAvatar.style.width = '38px';
            detailAvatar.style.height = '38px';
            detailAvatar.style.borderRadius = '50%';
            detailAvatar.style.objectFit = 'cover';
            detailAvatar.style.flexShrink = '0';
        }
        if (detailUsername) detailUsername.textContent = targetPost.author.username;
        if (catBadge && typeof getCategoryBadgeHTML === 'function') {
            catBadge.innerHTML = getCategoryBadgeHTML(targetPost.category);
        }

        if (authorNav) {
            authorNav.onclick = () => {
                window.location.href = `profile.html?u=${targetPost.author.username}`;
            };
        }

        const currentUser = JSON.parse(localStorage.getItem('user'));
        const likesArr = targetPost.likes || [];
        const isLiked = likesArr.includes(currentUser ? (currentUser.id || currentUser._id) : '');

        if (likeBtn) {
            likeBtn.classList.toggle('liked', isLiked);
            likeBtn.onclick = async () => {
                try {
                    const lRes = await fetch(`${API_BASE}/posts/${targetPost._id}/like`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const lData = await lRes.json();
                    if (!lRes.ok) throw new Error(lData.error);
                    openPostDetailModal(postId); // Refresh modal view
                } catch (e) {
                    alert(e.message);
                }
            };
        }

        if (likesCount) {
            likesCount.textContent = `${likesArr.length} like${likesArr.length !== 1 ? 's' : ''}`;
        }

        if (shareBtn) {
            shareBtn.onclick = () => {
                openShareModal(targetPost._id, targetPost);
            };
        }

        // Render Comments & Caption
        if (commentsList) {
            commentsList.innerHTML = ''; // Clear loading text

            // Caption as top item
            if (targetPost.caption) {
                const captionEl = document.createElement('div');
                captionEl.className = 'comment-item';
                captionEl.style.borderBottom = '1px solid var(--border-color)';
                captionEl.style.paddingBottom = '12px';
                captionEl.style.marginBottom = '8px';
                captionEl.innerHTML = `
                    <img src="${targetPost.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${targetPost.author.username}`}" class="comment-item-avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="">
                    <div style="flex: 1;">
                        <span class="comment-username" style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="window.location.href='profile.html?u=${targetPost.author.username}'">${targetPost.author.username}</span>
                        <span class="comment-text" style="color: var(--text-primary); margin-left: 6px;">${escapeHtml(targetPost.caption)}</span>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${formatTime(targetPost.createdAt)}</div>
                    </div>
                `;
                commentsList.appendChild(captionEl);
            }

            const commentsArr = targetPost.comments || [];
            if (commentsArr.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.color = 'var(--text-muted)';
                emptyMsg.style.textAlign = 'center';
                emptyMsg.style.padding = '20px 0';
                emptyMsg.style.fontSize = '0.85rem';
                emptyMsg.textContent = 'No comments yet. Be the first to comment!';
                commentsList.appendChild(emptyMsg);
            } else {
                commentsArr.forEach(c => {
                    const div = document.createElement('div');
                    div.className = 'comment-item';
                    div.style.position = 'relative';

                    const author = c.user || { username: c.username || 'user' };
                    const avatarSrc = author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${author.username}`;
                    const commentUserObjectId = author._id || author.id || c.user;
                    const isCommentOwner = currentUser && (commentUserObjectId === currentUser.id || commentUserObjectId === currentUser._id);
                    const isPostOwner = currentUser && targetPost.author && ((targetPost.author._id || targetPost.author) === (currentUser.id || currentUser._id));
                    const isAdmin = currentUser && currentUser.isAdmin;

                    div.innerHTML = `
                        <img src="${avatarSrc}" class="comment-item-avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="">
                        <div style="flex: 1; padding-right: 24px;">
                            <span class="comment-username" style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="window.location.href='profile.html?u=${author.username}'">${author.username}</span>
                            <span class="comment-text" id="comment-text-${c._id}" style="color: var(--text-primary); margin-left: 6px;">${escapeHtml(c.text)}</span>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${formatTime(c.createdAt || targetPost.createdAt)}</div>
                        </div>
                        ${(isCommentOwner || isPostOwner || isAdmin) ? `
                        <button class="comment-options-btn" style="position: absolute; right: 4px; top: 8px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;" title="Comment Options">
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
                                            } catch (e) {
                                                alert(e.message);
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
                                                    const res = await fetch(`${API_BASE}/posts/${postId}/comment/${c._id}`, {
                                                        method: 'DELETE',
                                                        headers: getHeaders()
                                                    });
                                                    const data = await res.json();
                                                    if (!res.ok) throw new Error(data.error);
                                                    div.remove();
                                                } catch (e) {
                                                    alert(e.message);
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
            }
        }

        // Setup comment posting inside detail modal
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
                if (window.location.pathname.includes('profile')) {
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
// SEARCH PANEL INTERACTIVE LOGIC
// =============================================================
function setupSearchPanel() {
    const searchBtns = document.querySelectorAll('#sidebar-search-btn, #mobile-search-btn, [aria-label="Search"]');
    const panel = document.getElementById('search-slider-panel');
    const input = document.getElementById('search-panel-input') || document.getElementById('search-users-input');
    const resultsContainer = document.getElementById('search-panel-results') || document.getElementById('search-results-list');
    const closeBtn = document.getElementById('close-search-panel-btn');

    if (!panel) return;

    searchBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.add('active');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.remove('active');
        });
    }

    // Close panel on clicking anywhere else on page
    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') && !panel.contains(e.target)) {
            let clickedBtn = false;
            searchBtns.forEach(btn => {
                if (btn.contains(e.target)) clickedBtn = true;
            });
            if (!clickedBtn) {
                panel.classList.remove('active');
            }
        }
    });

    if (!input || !resultsContainer) return;

    // Debounce search requests
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        
        if (query === '') {
            resultsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px 20px; font-size: 0.9rem;">Type a name or username to search people.</p>`;
            return;
        }

        resultsContainer.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 30px;">Searching...</p>`;

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
                    headers: getHeaders()
                });
                const users = await response.json();
                if (!response.ok) throw new Error(users.error || 'Search failed');

                if (!Array.isArray(users) || users.length === 0) {
                    resultsContainer.innerHTML = `<div class="search-no-results" style="padding: 30px; text-align: center; color: var(--text-muted);">No accounts found matching "${escapeHtml(query)}"</div>`;
                    return;
                }

                resultsContainer.innerHTML = '';
                users.forEach(user => {
                    const row = document.createElement('div');
                    row.className = 'user-profile-card';
                    row.style.cssText = 'padding: 12px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); transition: background 0.2s;';
                    row.innerHTML = `
                        <div class="user-card-info" style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                            <img src="${user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`}" alt="Avatar" class="user-card-avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-gold);">
                            <div class="user-card-names" style="min-width: 0; flex: 1;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span class="user-card-username" style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); display: block;">${escapeHtml(user.username)}</span>
                                    ${user.isVerified ? '<span style="color: var(--accent-gold); font-size: 0.8rem;">✓</span>' : ''}
                                </div>
                                <span class="user-card-fullname text-truncate" style="font-size: 0.78rem; color: var(--text-muted); display: block;">${escapeHtml(user.bio || 'Spotlite User')}</span>
                            </div>
                        </div>
                        <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 20px; font-weight: 700; shrink: 0;">Chat 💬</button>
                    `;
                    row.addEventListener('click', () => {
                        const isMessagesPage = window.location.pathname.includes('messages') || window.location.pathname.endsWith('/messages');
                        if (isMessagesPage && typeof openChatWindow === 'function') {
                            openChatWindow(user);
                            panel.classList.remove('active');
                        } else {
                            window.location.href = `messages.html?u=${encodeURIComponent(user.username)}`;
                        }
                    });
                    resultsContainer.appendChild(row);
                });
            } catch (err) {
                console.error("Search error:", err);
                resultsContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 0.85rem; text-align: center; padding: 20px;">Error searching users.</div>`;
            }
        }, 250);
    });
}

// Setup Group Chat Modal
function setupGroupChatModal() {
    const groupModal = document.getElementById('group-chat-modal-overlay');
    const groupBtn = document.getElementById('inbox-new-group-btn');
    const closeBtn = document.getElementById('close-group-modal-btn');
    const cancelBtn = document.getElementById('cancel-group-modal-btn');
    const submitBtn = document.getElementById('submit-create-group-btn');
    const userListContainer = document.getElementById('group-user-selection-list');
    const searchInput = document.getElementById('group-search-user-input');
    const groupNameInput = document.getElementById('group-name-input');

    let availableUsers = [];

    window.loadGroupUsers = async function() {
        const listEl = document.getElementById('group-user-selection-list');
        if (!listEl) return;
        listEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 12px;">Loading people...</p>';
        try {
            // /api/users/search returns a list of users matching query
            const res = await fetch(`${API_BASE}/users/search?q=a`, { headers: getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            availableUsers = Array.isArray(data) ? data : [];
            renderUserCheckboxes(availableUsers);
        } catch (err) {
            listEl.innerHTML = '<p style="color: var(--accent-red); text-align: center; padding: 12px;">Could not load people.</p>';
        }
    };

    function renderUserCheckboxes(users) {
        const listEl = document.getElementById('group-user-selection-list');
        if (!listEl) return;
        if (users.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 12px;">No people found.</p>';
            return;
        }
        listEl.innerHTML = users.map(u => `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border-color); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width: 32px; height: 32px; border-radius: 50%;">
                    <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${u.username}</span>
                </div>
                <input type="checkbox" class="group-user-checkbox" value="${u._id}" style="width: 18px; height: 18px; accent-color: var(--accent-gold);">
            </label>
        `).join('');
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            const filtered = availableUsers.filter(u => u.username.toLowerCase().includes(q));
            renderUserCheckboxes(filtered);
        });
    }

    if (groupBtn) {
        groupBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (groupModal) {
                groupModal.style.cssText = 'display: flex !important; z-index: 999999;';
            }
            window.loadGroupUsers();
        };
    }

    const hideModal = () => {
        if (groupModal) groupModal.style.cssText = 'display: none !important;';
        if (groupNameInput) groupNameInput.value = '';
    };

    if (closeBtn) closeBtn.onclick = hideModal;
    if (cancelBtn) cancelBtn.onclick = hideModal;

    if (submitBtn) {
        submitBtn.onclick = async () => {
            const groupName = groupNameInput ? groupNameInput.value.trim() : '';
            const checkedBoxes = Array.from(document.querySelectorAll('.group-user-checkbox:checked'));
            const selectedIds = checkedBoxes.map(cb => cb.value);

            if (!groupName) {
                alert('Please enter a group name.');
                return;
            }
            if (selectedIds.length === 0) {
                alert('Please select at least 1 person for the group.');
                return;
            }

            try {
                submitBtn.disabled = true;
                const res = await fetch(`${API_BASE}/messages`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        receiverIds: selectedIds,
                        groupName,
                        text: `Created group chat: ${groupName} 👥`
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                hideModal();
                showSpotliteToast(`Group "${groupName}" created! 👥✨`);
                if (typeof loadConversationsInbox === 'function') {
                    loadConversationsInbox();
                }
            } catch (err) {
                alert(err.message || 'Failed to create group');
            } finally {
                submitBtn.disabled = false;
            }
        };
    }
}

// =============================================================
// SETTINGS OVERLAY LOGIC
// =============================================================
function setupSettingsModal() {
    const modal = document.getElementById('settings-modal-overlay') || document.getElementById('settings-modal');
    const openBtns = document.querySelectorAll('#open-settings-btn, #mobile-settings-btn, [aria-label="Settings"]');
    const closeBtn = document.getElementById('close-settings-btn') || document.getElementById('close-settings-modal-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const oldPasswordInput = document.getElementById('settings-old-password');
    const newPasswordInput = document.getElementById('settings-new-password');
    const errorMsg = document.getElementById('settings-error');
    const successMsg = document.getElementById('settings-success');
    const privacyToggle = document.getElementById('privacy-toggle-input');

    if (!modal) return;

    function openModal() {
        modal.style.cssText = 'display: flex !important;';
        modal.classList.add('active');
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
        if (oldPasswordInput) oldPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        
        if (privacyToggle) {
            const isPrivate = localStorage.getItem('isPrivateAccount') === 'true';
            privacyToggle.checked = isPrivate;
        }
    }

    function closeModal() {
        modal.style.cssText = 'display: none !important;';
        modal.classList.remove('active');
    }

    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Theme Accent Option buttons inside Settings
    const themeOpts = modal.querySelectorAll('.theme-accent-opt');
    themeOpts.forEach(btn => {
        btn.onclick = () => {
            themeOpts.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'var(--border-color)';
            });
            btn.classList.add('active');
            btn.style.borderColor = 'var(--accent-gold)';
            const theme = btn.getAttribute('data-theme') || 'gold';
            applyThemeClass(theme);
            const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
            cachedUser.profileTheme = theme;
            localStorage.setItem('user', JSON.stringify(cachedUser));
        };
    });

    if (privacyToggle) {
        privacyToggle.addEventListener('change', () => {
            localStorage.setItem('isPrivateAccount', privacyToggle.checked);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const oldPassword = oldPasswordInput ? oldPasswordInput.value : '';
            const newPassword = newPasswordInput ? newPasswordInput.value : '';
            
            if (errorMsg) errorMsg.style.display = 'none';
            if (successMsg) successMsg.style.display = 'none';

            if (oldPassword && newPassword) {
                try {
                    saveBtn.textContent = 'Updating...';
                    saveBtn.disabled = true;

                    const response = await fetch(`${API_BASE}/users/change-password`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ currentPassword: oldPassword, oldPassword, newPassword })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Password update failed.');

                    if (successMsg) {
                        successMsg.textContent = 'Settings updated successfully!';
                        successMsg.style.display = 'block';
                    }
                    showSpotliteToast('⚙️ Preferences saved!');
                    if (oldPasswordInput) oldPasswordInput.value = '';
                    if (newPasswordInput) newPasswordInput.value = '';
                } catch (err) {
                    if (errorMsg) {
                        errorMsg.textContent = err.message;
                        errorMsg.style.display = 'block';
                    }
                } finally {
                    saveBtn.textContent = 'Save Preferences ✨';
                    saveBtn.disabled = false;
                }
            } else {
                showSpotliteToast('⚙️ Preferences saved!');
                closeModal();
            }
        });
    }
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
    setupGroupChatModal();

    if (typeof initSocketConnection === 'function') {
        initSocketConnection();
    }

    // Mobile back button
    const mobileBackBtn = document.getElementById('mobile-back-to-inbox-btn');
    if (mobileBackBtn) {
        mobileBackBtn.onclick = () => {
            const layout = document.querySelector('.messages-layout');
            if (layout) layout.classList.remove('mobile-chat-open');
            activeChatReceiverId = '';
            window.activeChatReceiverId = '';
        };
    }

    // Hook search buttons inside inbox to toggle search panel
    const newChatBtn = document.getElementById('inbox-new-chat-btn');
    const emptyChatBtn = document.getElementById('empty-state-new-chat-btn');

    if (newChatBtn) {
        newChatBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const panel = document.getElementById('search-slider-panel');
            const input = document.getElementById('search-users-input') || document.getElementById('search-panel-input');
            if (panel) {
                panel.classList.add('active');
                if (input) setTimeout(() => input.focus(), 100);
            }
        };
    }
    if (emptyChatBtn) {
        emptyChatBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const panel = document.getElementById('search-slider-panel');
            const input = document.getElementById('search-panel-input') || document.getElementById('search-users-input');
            if (panel) {
                panel.classList.add('active');
                if (input) setTimeout(() => input.focus(), 100);
            }
        };
    }

    // Inbox inline search filter
    const inboxSearchInput = document.getElementById('inbox-search-input');
    if (inboxSearchInput) {
        inboxSearchInput.addEventListener('input', () => {
            const q = inboxSearchInput.value.toLowerCase().trim();
            const items = document.querySelectorAll('#conversations-inbox-list .inbox-item');
            let hasVisible = false;
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(q)) {
                    item.style.display = 'flex';
                    hasVisible = true;
                } else {
                    item.style.display = 'none';
                }
            });

            let noMatchDiv = document.getElementById('inbox-search-no-match');
            if (!hasVisible && q.length > 0) {
                if (!noMatchDiv) {
                    noMatchDiv = document.createElement('div');
                    noMatchDiv.id = 'inbox-search-no-match';
                    noMatchDiv.style.cssText = 'text-align: center; padding: 20px 10px; color: var(--text-muted); font-size: 0.85rem;';
                    document.getElementById('conversations-inbox-list')?.appendChild(noMatchDiv);
                }
                noMatchDiv.innerHTML = `No chats found.<br><button style="margin-top: 8px; color: var(--accent-gold); background: none; border: none; font-weight: 700; cursor: pointer; text-decoration: underline;" onclick="if(window.openNewChatPanel) window.openNewChatPanel();">Search all users on Spotlite →</button>`;
                noMatchDiv.style.display = 'block';
            } else if (noMatchDiv) {
                noMatchDiv.style.display = 'none';
            }
        });
    }

    // Load active conversation cards
    await loadConversationsInbox();

    // Parse query param ?u=username to start a chat directly
    const params = new URLSearchParams(window.location.search);
    const startChatUsername = params.get('u');
    if (startChatUsername) {
        try {
            const response = await fetch(`${API_BASE}/users/profile/${startChatUsername.toLowerCase()}`, { headers: getHeaders() });
            const targetData = await response.json();
            if (response.ok && targetData.user) {
                openChatWindow(targetData.user);
            }
        } catch (e) {
            console.error("Failed to start chat from query param:", e);
        }
    }

    // Setup input message sending
    const sendBtn = document.getElementById('chat-send-btn');
    const textInput = document.getElementById('chat-text-input');

    if (textInput) {
        textInput.addEventListener('input', () => {
            if (textInput.value.trim() !== '') {
                if (sendBtn) sendBtn.classList.add('active');
            } else {
                if (sendBtn) sendBtn.classList.remove('active');
            }
        });

        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Chat Attachment Handlers
    const attachBtn = document.getElementById('chat-attach-file-btn');
    const fileInput = document.getElementById('chat-file-input');
    const previewBanner = document.getElementById('chat-attachment-preview');
    const fileNameSpan = document.getElementById('chat-attachment-name');
    const removeBtn = document.getElementById('chat-attachment-remove-btn');

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 15 * 1024 * 1024) {
                alert('File size exceeds 15MB limit.');
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                let messageType = 'file';
                if (file.type.startsWith('image/')) messageType = 'image';
                else if (file.type.startsWith('video/')) messageType = 'video';
                else if (file.type.startsWith('audio/')) messageType = 'audio';

                pendingChatAttachment = {
                    fileUrl: evt.target.result,
                    fileName: file.name,
                    fileType: file.type,
                    messageType
                };

                if (fileNameSpan) fileNameSpan.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                if (previewBanner) previewBanner.style.display = 'flex';
                if (sendBtn) sendBtn.classList.add('active');
            };
            reader.readAsDataURL(file);
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            pendingChatAttachment = null;
            if (fileInput) fileInput.value = '';
            if (previewBanner) previewBanner.style.display = 'none';
            if (textInput && textInput.value.trim() === '') {
                if (sendBtn) sendBtn.classList.remove('active');
            }
        });
    }

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

    // Real-time socket message listener
    if (window.socket) {
        window.socket.off('new_message');
        window.socket.on('new_message', (msg) => {
            const senderId = msg.sender ? (msg.sender._id || msg.sender) : '';
            if (activeChatReceiverId && String(senderId) === String(activeChatReceiverId)) {
                loadMessagesHistory();
            }
            loadConversationsInbox();
        });
    }
}

// Loads active contact cards
async function loadConversationsInbox() {
    const list = document.getElementById('conversations-inbox-list');
    if (!list) return;

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
    if (!user) return;
    const userId = user._id || user.id;
    activeChatReceiverId = userId;
    window.activeChatReceiverId = userId;
    window.activeChatRecipient = user;

    // Toggle panels
    const emptyState = document.getElementById('chat-empty-state');
    const activeWindow = document.getElementById('chat-window-active');
    const layout = document.querySelector('.messages-layout');

    if (emptyState) emptyState.style.display = 'none';
    if (activeWindow) activeWindow.style.display = 'flex';
    if (layout) layout.classList.add('mobile-chat-open');

    // Set header
    const headerAvatar = document.getElementById('active-chat-avatar');
    const headerUsername = document.getElementById('active-chat-username');
    
    if (headerAvatar) headerAvatar.src = user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`;
    if (headerUsername) headerUsername.textContent = `@${user.username}`;

    if (headerAvatar) {
        headerAvatar.style.cursor = 'pointer';
        headerAvatar.onclick = () => window.location.href = `profile.html?u=${user.username}`;
    }
    if (headerUsername) {
        headerUsername.style.cursor = 'pointer';
        headerUsername.onclick = () => window.location.href = `profile.html?u=${user.username}`;
    }

    // Call Action Buttons
    const audioCallBtn = document.getElementById('start-audio-call-btn');
    const videoCallBtn = document.getElementById('start-video-call-btn');
    if (audioCallBtn) {
        audioCallBtn.onclick = () => {
            window.location.href = `call.html?u=${user.username}&type=audio`;
        };
    }
    if (videoCallBtn) {
        videoCallBtn.onclick = () => {
            window.location.href = `call.html?u=${user.username}&type=video`;
        };
    }

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
            const isMe = msg.sender === currentUser.id || (msg.sender && msg.sender._id === currentUser.id);
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
                let contentHtml = '';

                if (msg.messageType === 'image' || (msg.fileUrl && (msg.fileUrl.startsWith('data:image') || msg.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)))) {
                    contentHtml += `<img src="${msg.fileUrl}" alt="Photo Attachment" style="max-width: 240px; border-radius: 8px; margin-bottom: 6px; display: block; cursor: pointer;" onclick="window.open('${msg.fileUrl}')">`;
                } else if (msg.messageType === 'video' || (msg.fileUrl && (msg.fileUrl.startsWith('data:video') || msg.fileUrl.match(/\.(mp4|webm|mov)/i)))) {
                    contentHtml += `<video src="${msg.fileUrl}" controls style="max-width: 250px; border-radius: 8px; margin-bottom: 6px; display: block;"></video>`;
                } else if (msg.messageType === 'audio' || msg.audioUrl || (msg.fileUrl && msg.fileUrl.startsWith('data:audio'))) {
                    contentHtml += `<audio src="${msg.audioUrl || msg.fileUrl}" controls style="max-width: 230px; margin-bottom: 6px; display: block;"></audio>`;
                } else if (msg.fileUrl) {
                    contentHtml += `<a href="${msg.fileUrl}" download="${escapeHtml(msg.fileName || 'attachment')}" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 8px; color: var(--accent-gold); font-weight: 600; text-decoration: none; margin-bottom: 6px;">📎 ${escapeHtml(msg.fileName || 'Download File')}</a>`;
                }

                if (msg.text) {
                    contentHtml += `<div>${escapeHtml(msg.text)}</div>`;
                }
                contentHtml += `<span class="message-time">${formatTime(msg.createdAt)}</span>`;
                bubble.innerHTML = contentHtml;
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
    const previewBanner = document.getElementById('chat-attachment-preview');
    const fileInput = document.getElementById('chat-file-input');

    if (!activeChatReceiverId || (text === '' && !pendingChatAttachment)) return;

    try {
        const payload = {
            receiverId: activeChatReceiverId,
            text
        };

        if (pendingChatAttachment) {
            payload.fileUrl = pendingChatAttachment.fileUrl;
            payload.fileName = pendingChatAttachment.fileName;
            payload.fileType = pendingChatAttachment.fileType;
            payload.messageType = pendingChatAttachment.messageType;
        }

        textInput.value = '';
        pendingChatAttachment = null;
        if (fileInput) fileInput.value = '';
        if (previewBanner) previewBanner.style.display = 'none';
        sendBtn.classList.remove('active');

        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // Refresh thread and inbox list
        await loadMessagesHistory();
        await loadConversationsInbox();

        const thread = document.getElementById('active-chat-thread');
        if (thread) thread.scrollTop = thread.scrollHeight;
    } catch (err) {
        alert('Failed to send message: ' + err.message);
    }
}

// Post Detail Modal End

// Global listener for post detail closing & feature initializers
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

    loadTrendingHashtags();
    initVoiceRecorder();
    setupEditProfileModal();
});

// =============================================================
// EDIT PROFILE MODAL INTERACTIVE CONTROLLER
// =============================================================
function setupEditProfileModal() {
    const editBtn = document.getElementById('open-edit-profile-btn');
    const modal = document.getElementById('edit-profile-modal-overlay');
    const closeBtn = document.getElementById('close-edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');

    const avatarFileInput = document.getElementById('edit-avatar-file-input');
    const avatarPreviewWrapper = document.getElementById('edit-avatar-file-label');
    const avatarPreviewImg = document.getElementById('edit-avatar-preview');
    const avatarUrlInput = document.getElementById('edit-avatar-url');

    const coverFileInput = document.getElementById('edit-cover-file-input');
    const coverUrlInput = document.getElementById('edit-cover-photo-url');

    const usernameInput = document.getElementById('edit-username');
    const bioInput = document.getElementById('edit-bio');
    const websiteInput = document.getElementById('edit-bio-link');
    const githubInput = document.getElementById('edit-github-url');
    const themeSelect = document.getElementById('edit-profile-theme');
    const spotlightCheckbox = document.getElementById('edit-spotlight-mode');
    const errorEl = document.getElementById('edit-profile-error');

    if (!editBtn || !modal) return;

    let pendingAvatarBase64 = null;
    let pendingCoverBase64 = null;

    if (avatarPreviewWrapper && avatarFileInput) {
        avatarPreviewWrapper.onclick = () => avatarFileInput.click();
        avatarFileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                if (typeof compressImage === 'function') {
                    pendingAvatarBase64 = await compressImage(file, 400, 400, 0.85);
                } else if (typeof fileToBase64 === 'function') {
                    pendingAvatarBase64 = await fileToBase64(file);
                }
                if (avatarPreviewImg && pendingAvatarBase64) avatarPreviewImg.src = pendingAvatarBase64;
                if (avatarUrlInput) avatarUrlInput.value = '';
            } catch (err) {
                console.error('Avatar image error:', err);
            }
        };
    }

    if (coverFileInput && coverUrlInput) {
        coverFileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                if (typeof fileToBase64 === 'function') {
                    pendingCoverBase64 = await fileToBase64(file);
                    coverUrlInput.value = file.name;
                }
            } catch (err) {
                console.error('Cover banner file error:', err);
            }
        };
    }

    editBtn.onclick = () => {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        pendingAvatarBase64 = null;
        pendingCoverBase64 = null;
        if (errorEl) errorEl.style.display = 'none';

        if (usernameInput) usernameInput.value = currentUser.username || '';
        if (bioInput) bioInput.value = currentUser.bio || '';
        if (websiteInput) websiteInput.value = currentUser.website || currentUser.bioLink || '';
        if (githubInput) githubInput.value = currentUser.github || currentUser.githubUrl || '';
        if (avatarUrlInput) avatarUrlInput.value = currentUser.avatar || '';
        if (avatarPreviewImg) avatarPreviewImg.src = currentUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser.username || 'user'}`;
        if (coverUrlInput) coverUrlInput.value = currentUser.coverPhoto || '';
        if (themeSelect) themeSelect.value = currentUser.profileTheme || currentUser.accentColor || 'gold';
        if (spotlightCheckbox) spotlightCheckbox.checked = Boolean(currentUser.spotlightMode);

        modal.style.display = 'flex';
        modal.classList.add('active');
    };

    function closeModal() {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    if (saveBtn) {
        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving... ✨';
            if (errorEl) errorEl.style.display = 'none';

            try {
                const finalAvatar = pendingAvatarBase64 || (avatarUrlInput ? avatarUrlInput.value.trim() : '');
                const finalCover = pendingCoverBase64 || (coverUrlInput ? coverUrlInput.value.trim() : '');

                const payload = {
                    username: usernameInput ? usernameInput.value.trim() : '',
                    bio: bioInput ? bioInput.value.trim() : '',
                    website: websiteInput ? websiteInput.value.trim() : '',
                    github: githubInput ? githubInput.value.trim() : '',
                    profileTheme: themeSelect ? themeSelect.value : 'gold',
                    spotlightMode: spotlightCheckbox ? spotlightCheckbox.checked : false
                };

                if (finalAvatar) payload.avatar = finalAvatar;
                if (finalCover) payload.coverPhoto = finalCover;

                const res = await fetch(`${API_BASE}/users/profile`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update profile');

                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                const updatedUser = data.token ? data : data;
                localStorage.setItem('user', JSON.stringify(updatedUser));
                if (typeof applyThemeClass === 'function') applyThemeClass(updatedUser.profileTheme);

                closeModal();
                if (typeof showToast === 'function') showToast('Profile updated successfully! ✨');

                window.location.reload();
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Error updating profile.';
                    errorEl.style.display = 'block';
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes ✨';
            }
        };
    }
}

// =============================================================
// NEW FEATURE HELPERS: THEMES, HASHTAGS, POLLS, REPOSTS & VOICE
// =============================================================

function setThemeMode(mode) {
    document.body.classList.remove('mode-dark', 'mode-oled', 'mode-light');
    document.body.classList.add('mode-' + mode);
    localStorage.setItem('spotlite_mode', mode);
    if (typeof showToast === 'function') showToast(`Theme changed to ${mode.toUpperCase()} 🎨`);
}

function setAccentTheme(accent) {
    if (typeof applyThemeClass === 'function') applyThemeClass(accent);
    try {
        const cachedUser = JSON.parse(localStorage.getItem('user'));
        if (cachedUser) {
            cachedUser.profileTheme = accent;
            localStorage.setItem('user', JSON.stringify(cachedUser));
        }
    } catch(e) {}
    if (typeof showToast === 'function') showToast(`Accent color updated to ${accent.toUpperCase()} ✨`);
}

async function loadTrendingHashtags() {
    const container = document.getElementById('trending-hashtags-list');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE}/posts/trending-tags`, { headers: getHeaders() });
        if (!res.ok) return;
        const tags = await res.json();
        if (tags && tags.length > 0) {
            container.innerHTML = tags.map(t => `
                <span class="tag-badge" onclick="filterByTag('${escapeHtml(t.tag)}')">
                    #${escapeHtml(t.tag)} <span class="tag-count">${t.count}</span>
                </span>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load trending tags:', e);
    }
}

function filterByTag(tag) {
    window.location.href = `index.html?hashtag=${encodeURIComponent(tag)}`;
}

async function votePollOption(postId, optionIndex) {
    try {
        const res = await fetch(`${API_BASE}/posts/${postId}/vote`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ optionIndex })
        });
        if (res.ok) {
            if (typeof showToast === 'function') showToast('Vote registered! 📊');
            if (typeof loadFeedPosts === 'function') loadFeedPosts();
        } else {
            const err = await res.json();
            if (typeof showToast === 'function') showToast(err.error || 'Failed to vote');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to vote');
    }
}

async function repostPost(postId) {
    const comment = prompt('Add a comment to your repost (optional):');
    if (comment === null) return;
    try {
        const res = await fetch(`${API_BASE}/posts/${postId}/repost`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ comment })
        });
        if (res.ok) {
            if (typeof showToast === 'function') showToast('Post reposted to your profile! 🚀');
            if (typeof loadFeedPosts === 'function') loadFeedPosts();
        } else {
            const err = await res.json();
            if (typeof showToast === 'function') showToast(err.error || 'Failed to repost');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to repost');
    }
}

function initVoiceRecorder() {
    const voiceBtn = document.getElementById('chat-voice-note-btn');
    if (!voiceBtn) return;
    let mediaRecorder = null;
    let audioChunks = [];

    voiceBtn.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            voiceBtn.style.color = '';
            voiceBtn.title = 'Record Voice Note 🎙️';
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64Audio = reader.result;
                        if (typeof activeChatUser !== 'undefined' && activeChatUser) {
                            await sendVoiceMessage(activeChatUser._id, base64Audio);
                        }
                    };
                    stream.getTracks().forEach(t => t.stop());
                };
                mediaRecorder.start();
                voiceBtn.style.color = '#ef4444';
                voiceBtn.title = 'Click to Stop & Send 🔴';
                if (typeof showToast === 'function') showToast('Recording voice note... Click again to send 🎙️');
            } catch (err) {
                if (typeof showToast === 'function') showToast('Microphone access unavailable or denied.');
            }
        }
    });
}

async function sendVoiceMessage(receiverId, audioUrl) {
    try {
        const res = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ receiverId, audioUrl, messageType: 'audio' })
        });
        if (res.ok) {
            if (typeof showToast === 'function') showToast('Voice note sent! 🎙️');
            if (typeof loadMessageThread === 'function') loadMessageThread(receiverId);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to send voice note');
    }
}

// Check admin role globally and expose sidebar Admin Panel if admin
document.addEventListener('DOMContentLoaded', () => {
    try {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.isAdmin) {
            const adminItem = document.getElementById('sidebar-admin-item');
            if (adminItem) adminItem.classList.remove('d-none');
        }
    } catch (e) {}
});

// -------------------------------------------------------------
// ADMIN DASHBOARD & USER MANAGEMENT
// -------------------------------------------------------------
let adminUsersData = [];

async function initAdminPage() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser || !currentUser.isAdmin) {
        alert('Access denied. Administrator privileges required.');
        window.location.href = 'index.html';
        return;
    }

    const adminItem = document.getElementById('sidebar-admin-item');
    if (adminItem) adminItem.classList.remove('d-none');

    const searchInput = document.getElementById('admin-search-input');
    const filterSelect = document.getElementById('admin-filter-select');

    if (searchInput) searchInput.addEventListener('input', renderAdminUsersTable);
    if (filterSelect) filterSelect.addEventListener('change', renderAdminUsersTable);

    await loadAdminUsersList();
}

async function loadAdminUsersList() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: getHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch accounts list');

        adminUsersData = data.users || [];

        // Update Dashboard Summary Counters
        if (data.stats) {
            const totalEl = document.getElementById('stat-total-users');
            const verifiedEl = document.getElementById('stat-verified-users');
            const bannedEl = document.getElementById('stat-banned-users');
            const adminEl = document.getElementById('stat-admin-users');

            if (totalEl) totalEl.textContent = data.stats.totalUsers;
            if (verifiedEl) verifiedEl.textContent = data.stats.verifiedCount;
            if (bannedEl) bannedEl.textContent = data.stats.bannedCount;
            if (adminEl) adminEl.textContent = data.stats.adminCount;
        }

        renderAdminUsersTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--accent-red); padding:20px;">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderAdminUsersTable() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const query = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('admin-filter-select')?.value || 'all';

    let filtered = adminUsersData.filter(u => {
        const matchesQuery = u.username.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        if (filter === 'verified') return u.isVerified;
        if (filter === 'banned') return u.isBanned;
        if (filter === 'admins') return u.isAdmin;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">No account records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
        const avatarUrl = u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`;
        
        let badgesHtml = '';
        if (u.isAdmin) badgesHtml += `<span class="badge-status badge-admin">Admin</span> `;
        if (u.isVerified) badgesHtml += `<span class="badge-status badge-verified">Verified</span> `;
        if (u.isBanned) badgesHtml += `<span class="badge-status badge-banned">Banned</span> `;
        if (!badgesHtml) badgesHtml = `<span class="badge-status badge-user">User</span>`;

        return `
            <tr>
                <td>
                    <div class="admin-user-cell">
                        <img src="${avatarUrl}" alt="" class="admin-user-avatar">
                        <div>
                            <div style="font-weight:700;">${escapeHtml(u.username)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(u.bio || '')}</div>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(u.email || 'N/A')}</td>
                <td>${dateStr}</td>
                <td>${badgesHtml}</td>
                <td>
                    <button class="admin-action-btn btn-verify" onclick="toggleAdminVerify('${u._id}')" title="Toggle Verification">
                        ${u.isVerified ? 'Unverify' : 'Verify'}
                    </button>
                    <button class="admin-action-btn btn-ban" onclick="toggleAdminBan('${u._id}')" title="Ban/Unban Account">
                        ${u.isBanned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="admin-action-btn btn-role" onclick="toggleAdminRole('${u._id}')" title="Toggle Admin Role">
                        ${u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                    <button class="admin-action-btn btn-delete" onclick="deleteAdminUser('${u._id}', '${escapeHtml(u.username)}')" title="Delete Account">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleAdminVerify(userId) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/verify`, { method: 'PUT', headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (typeof showToast === 'function') showToast(data.message);
        await loadAdminUsersList();
    } catch (err) {
        alert('Action failed: ' + err.message);
    }
}

async function toggleAdminBan(userId) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/ban`, { method: 'PUT', headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (typeof showToast === 'function') showToast(data.message);
        await loadAdminUsersList();
    } catch (err) {
        alert('Action failed: ' + err.message);
    }
}

async function toggleAdminRole(userId) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, { method: 'PUT', headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (typeof showToast === 'function') showToast(data.message);
        await loadAdminUsersList();
    } catch (err) {
        alert('Action failed: ' + err.message);
    }
}

async function deleteAdminUser(userId, username) {
    if (!confirm(`Are you sure you want to permanently delete account @${username}? This action cannot be undone.`)) return;

    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (typeof showToast === 'function') showToast(data.message);
        await loadAdminUsersList();
    } catch (err) {
        alert('Action failed: ' + err.message);
    }
}

// -------------------------------------------------------------
// SPOTLITE PWA SERVICE WORKER REGISTRATION
// -------------------------------------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] ServiceWorker registered with scope:', reg.scope))
            .catch(err => console.log('[PWA] ServiceWorker registration failed:', err));
    });
}

// -------------------------------------------------------------
// SPOTLITE WHATSAPP-STYLE INCOMING CALL & WEBRTC MODULE
// -------------------------------------------------------------
let peerConnection = null;
let localStream = null;
let activeCallTargetId = null;
let incomingCallData = null;
let signalPollingInterval = null;
let ringtoneAudioContext = null;
let ringtoneOscillator = null;
let ringtoneInterval = null;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

let callDurationSeconds = 0;
let callTimerInterval = null;

function startCallTimer() {
    callDurationSeconds = 0;
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callDurationSeconds++;
        const m = String(Math.floor(callDurationSeconds / 60)).padStart(2, '0');
        const s = String(callDurationSeconds % 60).padStart(2, '0');
        const statusEl = document.getElementById('call-status-text');
        if (statusEl) statusEl.textContent = `Connected ● ${m}:${s}`;
    }, 1000);
}

function stopCallTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
}

function formatCallDuration(seconds) {
    if (!seconds || seconds < 1) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
}

// Auto-inject WhatsApp-style Call Banner and Modals dynamically on ANY page if missing
function ensureCallModalsExist() {
    if (!document.getElementById('webrtc-call-modal')) {
        const div = document.createElement('div');
        div.innerHTML = `
        <!-- WHATSAPP FULLSCREEN WEBRTC VIDEO/AUDIO CALL INTERFACE -->
        <div class="modal-overlay" id="webrtc-call-modal" style="display: none; z-index: 200000; background: #0b141a; flex-direction: column; position: fixed; inset: 0; width: 100vw; height: 100vh; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif;">
            
            <!-- WhatsApp Call Header Bar -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 70px; background: linear-gradient(180deg, rgba(11, 20, 26, 0.95) 0%, rgba(11, 20, 26, 0) 100%); z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 24px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: #00a884; cursor: pointer;" title="End-to-End Encrypted">🔒</div>
                    <div>
                        <div id="call-peer-username" style="color: #e9edef; font-weight: 700; font-size: 1.1rem; letter-spacing: 0.3px;">@username</div>
                        <div id="call-status-text" style="font-size: 0.8rem; color: #00a884; font-weight: 600;">Spotlite WebRTC Call • 00:00</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 0.75rem; color: #8696a0; background: rgba(255,255,255,0.06); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">HD 720p P2P</span>
                </div>
            </div>

            <!-- WhatsApp Video Stage / Audio Fallback Canvas -->
            <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #111b21;">
                
                <!-- Remote Video Stream -->
                <video id="remote-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; background: #0b141a;"></video>
                
                <!-- Audio Call Avatar Screen (Shown if video is disabled) -->
                <div id="call-audio-avatar-container" style="display: none; position: absolute; inset: 0; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle, #182229 0%, #0b141a 100%); z-index: 5;">
                    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                        <div style="position: absolute; width: 180px; height: 180px; border-radius: 50%; border: 2px solid #00a884; opacity: 0.4; animation: whatsappPulse 2s infinite;"></div>
                        <div style="position: absolute; width: 230px; height: 230px; border-radius: 50%; border: 1.5px solid #00a884; opacity: 0.2; animation: whatsappPulse 2s infinite 0.5s;"></div>
                        <img src="" id="call-audio-avatar" style="width: 130px; height: 130px; border-radius: 50%; border: 3px solid #00a884; object-fit: cover; box-shadow: 0 12px 40px rgba(0, 168, 132, 0.4); z-index: 2;">
                    </div>
                    <h2 id="call-audio-username" style="color: #e9edef; margin: 24px 0 6px 0; font-size: 1.4rem; font-weight: 700;">Username</h2>
                    <p style="color: #8696a0; font-size: 0.9rem; margin: 0;">WhatsApp Voice Call</p>
                </div>

                <!-- Floating Picture-in-Picture Local Camera Feed -->
                <div id="local-video-container" style="position: absolute; bottom: 100px; right: 24px; width: 160px; height: 210px; background: #1f2c34; border: 2px solid #00a884; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.7); z-index: 15; transition: all 0.3s ease;">
                    <video id="local-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                </div>
            </div>

            <!-- WhatsApp Floating Control Dock -->
            <div style="position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 20px; background: rgba(17, 27, 33, 0.92); backdrop-filter: blur(20px); padding: 14px 28px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 16px 40px rgba(0,0,0,0.8);">
                <button id="toggle-audio-btn" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: #2a3942; color: #e9edef; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Mute Microphone">🎙️</button>
                <button id="toggle-video-btn" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: #2a3942; color: #e9edef; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Toggle Camera">📹</button>
                <button id="end-call-btn" style="width: 60px; height: 60px; border-radius: 50%; border: none; background: #ea0038; color: #ffffff; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(234, 0, 56, 0.5); transition: transform 0.2s;" title="End Call">📞</button>
            </div>
        </div>

        <!-- WHATSAPP FULLSCREEN INCOMING CALL DIALOG -->
        <div class="modal-overlay" id="incoming-call-modal" style="display: none; z-index: 200001; background: #0b141a; flex-direction: column; align-items: center; justify-content: space-between; position: fixed; inset: 0; width: 100vw; height: 100vh; padding: 60px 24px; box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif;">
            
            <div style="text-align: center; margin-top: 40px;">
                <div style="color: #00a884; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">🔒 WhatsApp End-to-End Encrypted</div>
                <h2 id="incoming-call-type" style="color: #e9edef; margin: 0; font-size: 1.5rem; font-weight: 800;">Incoming Spotlite Call</h2>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                <div style="position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                    <div style="position: absolute; width: 170px; height: 170px; border-radius: 50%; border: 2px solid #00a884; opacity: 0.4; animation: whatsappPulse 1.8s infinite;"></div>
                    <div style="position: absolute; width: 220px; height: 220px; border-radius: 50%; border: 1.5px solid #00a884; opacity: 0.2; animation: whatsappPulse 1.8s infinite 0.4s;"></div>
                    <img src="" id="incoming-caller-avatar" style="width: 120px; height: 120px; border-radius: 50%; border: 3px solid #00a884; object-fit: cover; box-shadow: 0 10px 35px rgba(0,168,132,0.4); z-index: 2;">
                </div>
                <h3 id="incoming-caller-username" style="color: #ffffff; margin: 0 0 8px 0; font-weight: 800; font-size: 1.6rem;">Caller Username</h3>
                <p style="color: #8696a0; font-size: 0.95rem; margin: 0;">Ringing...</p>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 48px; margin-bottom: 30px;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <button id="decline-call-btn" style="width: 68px; height: 68px; border-radius: 50%; border: none; background: #ea0038; color: #fff; font-size: 1.7rem; cursor: pointer; box-shadow: 0 8px 25px rgba(234,0,56,0.5); transition: transform 0.2s;" title="Decline">✖</button>
                    <span style="color: #8696a0; font-size: 0.8rem; font-weight: 600;">Decline</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <button id="accept-call-btn" style="width: 68px; height: 68px; border-radius: 50%; border: none; background: #00a884; color: #fff; font-size: 1.7rem; cursor: pointer; box-shadow: 0 8px 25px rgba(0,168,132,0.6); animation: whatsappBounce 1.5s infinite; transition: transform 0.2s;" title="Accept">📞</button>
                    <span style="color: #00a884; font-size: 0.8rem; font-weight: 700;">Accept</span>
                </div>
            </div>
        </div>

        <!-- WHATSAPP-STYLE FLOATING TOP NOTIFICATION CARD -->
        <div id="whatsapp-call-banner" style="display: none; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 999999; background: #111b21; border: 1.5px solid #00a884; border-radius: 24px; padding: 14px 22px; align-items: center; gap: 16px; box-shadow: 0 18px 50px rgba(0,0,0,0.9); min-width: 320px; max-width: 440px;">
            <img id="whatsapp-caller-avatar" src="" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #00a884; object-fit: cover;">
            <div style="flex: 1; overflow: hidden;">
                <div id="whatsapp-caller-name" style="font-weight: 800; color: #e9edef; font-size: 1.05rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">@username</div>
                <div id="whatsapp-call-subtitle" style="font-size: 0.82rem; color: #00a884; font-weight: 600;">📲 WhatsApp Video Call...</div>
            </div>
            <div style="display: flex; gap: 12px;">
                <button onclick="declineIncomingCall()" style="background: #ea0038; color: white; border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Decline">✕</button>
                <button onclick="acceptIncomingCall()" style="background: #00a884; color: white; border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(0,168,132,0.6);" title="Accept">📞</button>
            </div>
        </div>

        <!-- WhatsApp Keyframe Animations -->
        <style>
            @keyframes whatsappPulse {
                0% { transform: scale(0.9); opacity: 0.6; }
                50% { transform: scale(1.15); opacity: 0.2; }
                100% { transform: scale(0.9); opacity: 0.6; }
            }
            @keyframes whatsappBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-6px); }
            }
        </style>
        `;
        document.body.appendChild(div);

        // Bind control listeners
    }
}

// Bind all call modal control buttons — runs regardless of whether modals were injected or already existed
function bindCallModalButtons() {
    const endBtn = document.getElementById('end-call-btn');
    const acceptBtn = document.getElementById('accept-call-btn');
    const declineBtn = document.getElementById('decline-call-btn');
    const muteBtn = document.getElementById('toggle-audio-btn');
    const camBtn = document.getElementById('toggle-video-btn');
    const speakerBtn = document.getElementById('toggle-speaker-btn');

    if (endBtn) { endBtn.onclick = endActiveCall; }
    if (acceptBtn) { acceptBtn.onclick = acceptIncomingCall; }
    if (declineBtn) { declineBtn.onclick = declineIncomingCall; }

    if (muteBtn) {
        muteBtn.onclick = () => {
            if (!localStream) return;
            const track = localStream.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                muteBtn.style.background = track.enabled ? '#2a3942' : '#ea0038';
                muteBtn.textContent = track.enabled ? '🎙️' : '🔇';
                muteBtn.title = track.enabled ? 'Mute Microphone' : 'Unmute Microphone';
            }
        };
    }

    if (camBtn) {
        camBtn.onclick = () => {
            if (!localStream) return;
            const track = localStream.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                camBtn.style.background = track.enabled ? '#2a3942' : '#ea0038';
                camBtn.textContent = track.enabled ? '📹' : '🚫';
                camBtn.title = track.enabled ? 'Turn Off Camera' : 'Turn On Camera';
                const audioContainer = document.getElementById('call-audio-avatar-container');
                if (audioContainer) audioContainer.style.display = track.enabled ? 'none' : 'flex';
            } else {
                // No video track — toggle audio avatar visibility
                const audioContainer = document.getElementById('call-audio-avatar-container');
                if (audioContainer) {
                    const isVisible = audioContainer.style.display === 'flex';
                    audioContainer.style.display = isVisible ? 'none' : 'flex';
                }
            }
        };
    }

    if (speakerBtn) {
        speakerBtn.onclick = () => {
            speakerBtn.classList.toggle('active');
            speakerBtn.style.background = speakerBtn.classList.contains('active') ? '#2a3942' : '#ea0038';
        };
    }
}

let activeRingtoneAudio = null;

function playRingtone() {
    stopRingtone();
    try {
        activeRingtoneAudio = new Audio('/ringtone.mp3');
        activeRingtoneAudio.loop = true;
        const playPromise = activeRingtoneAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn('[Ringtone] ringtone.mp3 playback blocked/failed, using synth fallback:', err);
                startSynthRingtoneFallback();
            });
        }
    } catch (e) {
        startSynthRingtoneFallback();
    }
}

function startSynthRingtoneFallback() {
    try {
        ringtoneAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const ringStep = () => {
            if (!ringtoneAudioContext) return;
            const osc = ringtoneAudioContext.createOscillator();
            const gain = ringtoneAudioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(850, ringtoneAudioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ringtoneAudioContext.currentTime + 0.4);
            gain.gain.setValueAtTime(0.2, ringtoneAudioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ringtoneAudioContext.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ringtoneAudioContext.destination);
            osc.start();
            osc.stop(ringtoneAudioContext.currentTime + 0.4);
        };
        ringStep();
        ringtoneInterval = setInterval(ringStep, 2000);
    } catch (e) {}
}

function stopRingtone() {
    if (activeRingtoneAudio) {
        try {
            activeRingtoneAudio.pause();
            activeRingtoneAudio.currentTime = 0;
        } catch (e) {}
        activeRingtoneAudio = null;
    }
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
    if (ringtoneAudioContext) {
        try { ringtoneAudioContext.close(); } catch (e) {}
        ringtoneAudioContext = null;
    }
}

// Request Desktop/Mobile Native Push Notifications
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Send signal over Socket and REST endpoint
async function sendCallSignal(type, payload = {}) {
    const data = {
        recipientId: payload.targetId || payload.recipientId || activeCallTargetId,
        type: type,
        ...payload
    };

    if (window.socket && window.socket.connected) {
        window.socket.emit(type === 'offer' ? 'call-user' : type === 'answer' ? 'make-answer' : type === 'ice' ? 'ice-candidate' : type === 'end' ? 'end-call' : 'reject-call', data);
    }

    try {
        await fetch(`${API_BASE}/calls/signal`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error('REST signal fallback error:', e);
    }
}

// REST Signal Poller for serverless fallback
async function pollCallSignals() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/calls/signals`, { headers: getHeaders() });
        if (!res.ok) return;
        const signals = await res.json();

        for (const sig of signals) {
            handleIncomingSignal(sig);
        }
    } catch (e) {
        // Silent poll error handling
    }
}

async function handleIncomingSignal(data) {
    ensureCallModalsExist();

    if (data.type === 'offer') {
        incomingCallData = {
            callerId: data.senderId,
            offer: data.offer,
            callType: data.callType,
            callerInfo: data.callerInfo
        };

        playRingtone();

        const callerName = (data.callerInfo && data.callerInfo.username) ? `@${data.callerInfo.username}` : 'Spotlite User';
        const callerAvatar = (data.callerInfo && data.callerInfo.avatar) ? data.callerInfo.avatar : 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=caller';
        const callTypeLabel = `Incoming ${data.callType === 'audio' ? 'Audio 📞' : 'Video 📹'} Call...`;

        // 1. WhatsApp Top Banner
        const banner = document.getElementById('whatsapp-call-banner');
        const bAvatar = document.getElementById('whatsapp-caller-avatar');
        const bName = document.getElementById('whatsapp-caller-name');
        const bSub = document.getElementById('whatsapp-call-subtitle');

        if (banner) {
            if (bAvatar) bAvatar.src = callerAvatar;
            if (bName) bName.textContent = callerName;
            if (bSub) bSub.textContent = `📲 ${callTypeLabel}`;
            banner.style.display = 'flex';
        }

        // 2. Fullscreen Ringing Modal
        const modal = document.getElementById('incoming-call-modal');
        const mAvatar = document.getElementById('incoming-caller-avatar');
        const mName = document.getElementById('incoming-caller-username');
        const mSub = document.getElementById('incoming-call-type');

        if (modal) {
            if (mAvatar) mAvatar.src = callerAvatar;
            if (mName) mName.textContent = callerName;
            if (mSub) mSub.textContent = callTypeLabel;
            modal.style.display = 'flex';
        }

        // 3. System Native Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Incoming Call from ${callerName}`, {
                body: `${callTypeLabel} - Click to answer!`,
                icon: callerAvatar
            });
        }
    } else if (data.type === 'answer') {
        stopRingtone();
        const banner = document.getElementById('whatsapp-call-banner');
        if (banner) banner.style.display = 'none';

        if (peerConnection && data.answer) {
            try {
                if (peerConnection.signalingState !== 'stable') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    startCallTimer();
                }
            } catch (e) {
                console.error('Error setting remote description answer:', e);
            }
        }
    } else if (data.type === 'ice') {
        if (peerConnection && data.candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Error adding ICE candidate:', e);
            }
        }
    } else if (data.type === 'end') {
        stopRingtone();
        cleanupCallUI();
        if (typeof showToast === 'function') showToast('Call ended.');
    } else if (data.type === 'reject') {
        stopRingtone();
        cleanupCallUI();
        if (typeof showToast === 'function') showToast('Call declined.');
    }
}

function initSocketClient() {
    if (window.socket) return window.socket;
    const token = localStorage.getItem('token');
    if (!token) return null;

    if (typeof io === 'function') {
        try {
            window.socket = io({ auth: { token } });
            console.log('[Socket.io] Client initialized successfully.');

            window.socket.on('new_message', (msg) => {
                const senderId = String(msg.sender?._id || msg.sender?.id || msg.sender || '');
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const myId = String(currentUser._id || currentUser.id || '');
                if (window.activeChatReceiverId && (window.activeChatReceiverId === senderId || senderId === myId)) {
                    if (typeof loadChatThread === 'function') {
                        loadChatThread(window.activeChatReceiverId);
                    }
                }
                if (typeof loadConversationsInbox === 'function') {
                    loadConversationsInbox();
                }
            });
        } catch (e) {
            console.warn('[Socket.io] Initialization failed:', e);
        }
    }
    return window.socket;
}

(function loadSocketIoScript() {
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            initSocketClient();
            if (typeof initWebRTCEvents === 'function') initWebRTCEvents();
        };
        script.onerror = () => {
            console.warn('Socket.io script unavailable, using REST fallback.');
        };
        document.head.appendChild(script);
    } else {
        initSocketClient();
    }
})();

function initWebRTCEvents() {
    ensureCallModalsExist();
    bindCallModalButtons();
    initSocketClient();

    const socket = window.socket;
    if (socket) {
        socket.on('incoming-call', (data) => handleIncomingSignal({ type: 'offer', ...data }));
        socket.on('call-answered', (data) => handleIncomingSignal({ type: 'answer', ...data }));
        socket.on('ice-candidate', (data) => handleIncomingSignal({ type: 'ice', ...data }));
        socket.on('call-ended', (data) => handleIncomingSignal({ type: 'end', ...data }));
        socket.on('call-rejected', (data) => handleIncomingSignal({ type: 'reject', ...data }));
    }

    // Start background REST poller every 1 second globally for fast serverless signaling
    if (!signalPollingInterval) {
        signalPollingInterval = setInterval(pollCallSignals, 1000);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const peerId = urlParams.get('peerId');
    const callType = urlParams.get('type');

    if (peerId) {
        fetch(`${API_BASE}/users/all`, { headers: getHeaders() })
            .then(res => res.json())
            .then(users => {
                const userList = Array.isArray(users) ? users : (Array.isArray(users?.users) ? users.users : []);
                const peer = userList.find(u => (u._id === peerId || u.id === peerId));
                if (peer) {
                    window.activeChatRecipient = peer;
                    window.activeChatReceiverId = peer._id || peer.id;
                    startWebRTCCall(callType === 'audio');
                }
            })
            .catch(e => console.error('Failed to load peer user for call:', e));
    }
}

// Safely acquire user media stream with fallback
async function obtainUserMediaStream(audioOnly = false) {
    try {
        return await navigator.mediaDevices.getUserMedia({ video: !audioOnly, audio: true });
    } catch (e1) {
        console.warn('[WebRTC] Full media stream failed:', e1.message);
    }

    try {
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    } catch (e2) {
        console.warn('[WebRTC] Audio-only media stream failed:', e2.message);
    }

    // Virtual stream fallback for hardware locks
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷 Spotlite Virtual Stream', 320, 230);
    ctx.fillStyle = '#8f93a8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('(Hardware camera in use by another app)', 320, 260);

    const canvasStream = canvas.captureStream(15);
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const synthAudioTrack = dst.stream.getAudioTracks()[0];
        if (synthAudioTrack) canvasStream.addTrack(synthAudioTrack);
    } catch (e) {}

    if (typeof showToast === 'function') {
        showToast('Camera/Mic in use by another app. Using Spotlite Virtual Stream.');
    }
    return canvasStream;
}

async function startWebRTCCall(audioOnly = false) {
    ensureCallModalsExist();

    let activeChatUser = window.activeChatRecipient;
    if (!activeChatUser && typeof activeChatReceiverId !== 'undefined' && activeChatReceiverId) {
        const usernameEl = document.getElementById('active-chat-username');
        const avatarEl = document.getElementById('active-chat-avatar');
        activeChatUser = {
            _id: activeChatReceiverId,
            username: usernameEl ? usernameEl.textContent : 'User',
            avatar: avatarEl ? avatarEl.src : ''
        };
    }

    if (!activeChatUser || (!activeChatUser._id && !activeChatUser.id)) {
        alert('Please select and open a chat conversation to start a call.');
        return;
    }

    activeCallTargetId = activeChatUser._id || activeChatUser.id;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    if ((currentUser._id || currentUser.id) === activeCallTargetId) {
        alert('You cannot start a call with yourself. Please select another user to test calling.');
        return;
    }

    try {
        localStream = await obtainUserMediaStream(audioOnly);

        const localVid = document.getElementById('local-video');
        if (localVid) localVid.srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            const remoteVid = document.getElementById('remote-video');
            if (remoteVid && event.streams[0]) {
                remoteVid.srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignal('ice', {
                    targetId: activeCallTargetId,
                    candidate: event.candidate
                });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await sendCallSignal('offer', {
            recipientId: activeCallTargetId,
            offer: offer,
            callType: audioOnly ? 'audio' : 'video',
            callerInfo: {
                username: currentUser.username,
                avatar: currentUser.avatar
            }
        });

        const modal = document.getElementById('webrtc-call-modal');
        const peerAvatar = document.getElementById('call-peer-avatar');
        const peerUsername = document.getElementById('call-peer-username');
        const callStatus = document.getElementById('call-status-text');
        const audioAvatar = document.getElementById('call-audio-avatar');
        const audioUsername = document.getElementById('call-audio-username');
        const audioContainer = document.getElementById('call-audio-avatar-container');

        if (modal) {
            const avatarUrl = activeChatUser.avatar || 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=user';
            if (peerAvatar) peerAvatar.src = avatarUrl;
            if (peerUsername) peerUsername.textContent = `@${activeChatUser.username}`;
            if (callStatus) callStatus.textContent = 'Ringing... Waiting for answer';
            if (audioAvatar) audioAvatar.src = avatarUrl;
            if (audioUsername) audioUsername.textContent = `@${activeChatUser.username}`;
            if (audioContainer) audioContainer.style.display = audioOnly ? 'flex' : 'none';
            modal.style.display = 'flex';
        }
    } catch (err) {
        console.error('Failed to access camera/microphone:', err);
        alert('Could not access microphone/camera for calling: ' + err.message);
    }
}

async function acceptIncomingCall() {
    ensureCallModalsExist();
    stopRingtone();

    const banner = document.getElementById('whatsapp-call-banner');
    if (banner) banner.style.display = 'none';

    const modalInc = document.getElementById('incoming-call-modal');
    if (modalInc) modalInc.style.display = 'none';

    if (!incomingCallData) return;

    activeCallTargetId = incomingCallData.callerId;
    const isAudioOnly = incomingCallData.callType === 'audio';

    try {
        localStream = await obtainUserMediaStream(isAudioOnly);

        const localVid = document.getElementById('local-video');
        if (localVid) localVid.srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            const remoteVid = document.getElementById('remote-video');
            if (remoteVid && event.streams[0]) {
                remoteVid.srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignal('ice', {
                    targetId: activeCallTargetId,
                    candidate: event.candidate
                });
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await sendCallSignal('answer', {
            targetId: activeCallTargetId,
            answer: answer
        });

        const callModal = document.getElementById('webrtc-call-modal');
        const peerAvatar = document.getElementById('call-peer-avatar');
        const peerUsername = document.getElementById('call-peer-username');
        const callStatus = document.getElementById('call-status-text');
        const audioAvatar = document.getElementById('call-audio-avatar');
        const audioUsername = document.getElementById('call-audio-username');
        const audioContainer = document.getElementById('call-audio-avatar-container');

        if (callModal) {
            const avatarUrl = (incomingCallData.callerInfo && incomingCallData.callerInfo.avatar) ? incomingCallData.callerInfo.avatar : 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=user';
            const usernameStr = (incomingCallData.callerInfo && incomingCallData.callerInfo.username) ? `@${incomingCallData.callerInfo.username}` : 'Spotlite User';
            
            if (peerAvatar) peerAvatar.src = avatarUrl;
            if (peerUsername) peerUsername.textContent = usernameStr;
            if (callStatus) callStatus.textContent = 'Connected ● 00:00';
            if (audioAvatar) audioAvatar.src = avatarUrl;
            if (audioUsername) audioUsername.textContent = usernameStr;
            if (audioContainer) audioContainer.style.display = isAudioOnly ? 'flex' : 'none';
            callModal.style.display = 'flex';
            startCallTimer();
        }
    } catch (err) {
        console.error('Error accepting call:', err);
        alert('Failed to establish call stream: ' + err.message);
    }
}

function declineIncomingCall() {
    stopRingtone();

    const banner = document.getElementById('whatsapp-call-banner');
    if (banner) banner.style.display = 'none';

    const modalInc = document.getElementById('incoming-call-modal');
    if (modalInc) modalInc.style.display = 'none';

    if (incomingCallData) {
        sendCallSignal('reject', { targetId: incomingCallData.callerId });
    }
    incomingCallData = null;
}

function endActiveCall() {
    stopRingtone();
    stopCallTimer();
    const duration = callDurationSeconds;
    if (activeCallTargetId) {
        sendCallSignal('end', { targetId: activeCallTargetId });
    }
    // Save call to history in chat
    if (typeof appendCallRecordToChat === 'function') {
        appendCallRecordToChat('outgoing', duration);
    }
    cleanupCallUI();
}

function cleanupCallUI() {
    stopRingtone();
    stopCallTimer();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    activeCallTargetId = null;
    incomingCallData = null;

    const callModal = document.getElementById('webrtc-call-modal');
    const incomingModal = document.getElementById('incoming-call-modal');
    const banner = document.getElementById('whatsapp-call-banner');

    if (callModal) callModal.style.display = 'none';
    if (incomingModal) incomingModal.style.display = 'none';
    if (banner) banner.style.display = 'none';
}

function startCallWithPeer(peerId, username, avatar) {
    if (!peerId) return;
    window.activeChatRecipient = { _id: peerId, username: username || 'user', avatar: avatar || '' };
    window.activeChatReceiverId = peerId;
    startWebRTCCall(false);
}

// Expose call functions globally on window
window.startWebRTCCall = startWebRTCCall;
window.endWebRTCCall = endActiveCall;
window.endActiveCall = endActiveCall;
window.acceptIncomingCall = acceptIncomingCall;
window.declineIncomingCall = declineIncomingCall;
window.ensureCallModalsExist = ensureCallModalsExist;
window.bindCallModalButtons = bindCallModalButtons;
window.initWebRTCEvents = initWebRTCEvents;
window.startCallWithPeer = startCallWithPeer;

// Append a call record bubble into the active chat thread
function appendCallRecordToChat(direction, durationSec, callType) {
    const thread = document.getElementById('active-chat-thread');
    if (!thread) return;
    const type = callType || (window._lastCallType || 'video');
    const icon = type === 'audio' ? '📞' : '📹';
    const label = direction === 'outgoing' ? 'Outgoing Call' : (durationSec > 0 ? 'Incoming Call' : 'Missed Call');
    const durStr = formatCallDuration(durationSec);
    const colorClass = direction === 'missed' ? '#ea0038' : '#00a884';

    const bubble = document.createElement('div');
    bubble.className = 'call-history-bubble';
    bubble.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        background: rgba(0,168,132,0.1); border: 1px solid rgba(0,168,132,0.25);
        border-radius: 16px; padding: 12px 18px; margin: 8px auto;
        max-width: 320px; cursor: pointer;
        font-family: 'Inter', sans-serif;
    `;
    bubble.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${colorClass}22;
            display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink:0;">${icon}</div>
        <div>
            <div style="color: #e9edef; font-weight: 700; font-size: 0.95rem;">${label}</div>
            <div style="color: #8696a0; font-size: 0.78rem;">${durStr ? durStr + ' · ' : ''}${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="margin-left:auto; color:${colorClass}; font-size:0.8rem; font-weight:700;">${direction === 'missed' ? 'MISSED' : '▲'}</div>
    `;
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
}

// Load call history from server and inject into chat thread
async function loadCallHistory(peerId) {
    try {
        const res = await fetch(`${API_BASE}/calls/history/${peerId}`, { headers: getHeaders() });
        if (!res.ok) return;
        const records = await res.json();
        const thread = document.getElementById('active-chat-thread');
        if (!thread) return;

        // Remove old call history bubbles
        thread.querySelectorAll('.call-history-bubble').forEach(b => b.remove());

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const myId = String(currentUser._id || currentUser.id || '');

        records.reverse().forEach(record => {
            const isOutgoing = String(record.caller?._id || record.caller) === myId;
            const icon = record.callType === 'audio' ? '📞' : '📹';
            const isMissed = record.status === 'missed' || record.status === 'rejected';
            const label = isMissed ? 'Missed Call' : (isOutgoing ? 'Outgoing Call' : 'Incoming Call');
            const durStr = formatCallDuration(record.duration);
            const color = isMissed ? '#ea0038' : '#00a884';
            const arrow = isOutgoing ? '▲' : '▼';
            const time = new Date(record.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

            const bubble = document.createElement('div');
            bubble.className = 'call-history-bubble';
            bubble.style.cssText = `
                display: flex; align-items: center; gap: 12px;
                background: ${isMissed ? 'rgba(234,0,56,0.08)' : 'rgba(0,168,132,0.08)'};
                border: 1px solid ${isMissed ? 'rgba(234,0,56,0.2)' : 'rgba(0,168,132,0.2)'};
                border-radius: 16px; padding: 12px 18px; margin: 6px auto;
                max-width: 320px; font-family: 'Inter',sans-serif;
            `;
            bubble.innerHTML = `
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}22;
                    display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">${icon}</div>
                <div>
                    <div style="color: #e9edef; font-weight: 700; font-size: 0.95rem;">${label}</div>
                    <div style="color: #8696a0; font-size: 0.78rem;">${durStr ? durStr + ' · ' : ''}${time}</div>
                </div>
                <div style="margin-left:auto; color:${color}; font-size:0.85rem; font-weight:700;">${isMissed ? 'MISSED' : arrow}</div>
            `;
            thread.insertBefore(bubble, thread.firstChild);
        });
    } catch (e) {
        console.warn('[CallHistory] Could not load call history:', e);
    }
}

// Web Audio Call Ringtone & Ringback Synthesizer
let ringerAudioCtx = null;
let ringerOsc1 = null;
let ringerOsc2 = null;
let ringerInterval = null;

let customRingtoneAudio = null;

function playCallRingtone() {
    stopCallRingtone();
    
    // Check for custom ringtone file (public/ringtone.mp3 or public/ringtone.wav)
    try {
        customRingtoneAudio = new Audio('/ringtone.mp3');
        customRingtoneAudio.loop = true;
        const playPromise = customRingtoneAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // If ringtone.mp3 is missing or blocked, fallback to Web Audio Synth
                customRingtoneAudio = null;
                startSynthRingtone();
            });
        }
        return;
    } catch (e) {
        customRingtoneAudio = null;
    }
    
    startSynthRingtone();
}

function startSynthRingtone() {
    try {
        ringerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const pulse = () => {
            if (!ringerAudioCtx || ringerAudioCtx.state === 'closed') return;
            const now = ringerAudioCtx.currentTime;
            
            // Dual harmonic ringer tone (425Hz + 450Hz)
            const osc1 = ringerAudioCtx.createOscillator();
            const osc2 = ringerAudioCtx.createOscillator();
            const gain = ringerAudioCtx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(425, now);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(450, now);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ringerAudioCtx.destination);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 1.2);
            osc2.stop(now + 1.2);
        };
        
        pulse();
        ringerInterval = setInterval(pulse, 2400);
    } catch (e) {
        console.warn('Web Audio ringer exception:', e);
    }
}

function stopCallRingtone() {
    if (customRingtoneAudio) {
        try {
            customRingtoneAudio.pause();
            customRingtoneAudio.currentTime = 0;
        } catch (e) {}
        customRingtoneAudio = null;
    }
    if (ringerInterval) {
        clearInterval(ringerInterval);
        ringerInterval = null;
    }
    if (ringerAudioCtx) {
        try { ringerAudioCtx.close(); } catch(e) {}
        ringerAudioCtx = null;
    }
}


async function toggleScreenShare() {
    if (!peerConnection) {
        if (typeof showToast === 'function') showToast('No active WebRTC connection for screen share.');
        return;
    }
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack);
            }
            const localVid = document.getElementById('local-video');
            if (localVid) localVid.srcObject = screenStream;
            
            screenTrack.onended = () => {
                if (localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    if (sender && videoTrack) sender.replaceTrack(videoTrack);
                    if (localVid) localVid.srcObject = localStream;
                }
            };
            if (typeof showToast === 'function') showToast('Screen sharing started 🖥️');
        }
    } catch (err) {
        console.warn('Screen share failed or cancelled:', err);
    }
}

// =============================================================
// CALL HISTORY CONTROLLER (call.html)
// =============================================================

// Fetch all call history for Call Hub page
async function loadAllCallHistory(containerId = 'call-history-list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    try {
        const res = await fetch(`${API_BASE}/calls/history`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch call history');
        const records = await res.json();
        
        if (records.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">📞</div>
                    <p style="font-weight: 600; margin-bottom: 4px;">No call history found</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Your recent audio & video call logs will appear here.</p>
                </div>
            `;
            return;
        }
        
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const myId = String(currentUser._id || currentUser.id || '');
        
        container.innerHTML = records.map(rec => {
            const isOutgoing = String(rec.caller?._id || rec.caller) === myId;
            const peer = isOutgoing ? rec.callee : rec.caller;
            const peerName = peer?.username ? `@${peer.username}` : 'Unknown User';
            const peerAvatar = peer?.avatar || 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=user';
            const icon = rec.callType === 'audio' ? '📞' : '📹';
            const isMissed = rec.status === 'rejected' || rec.status === 'missed';
            const statusLabel = isMissed ? 'Missed Call' : (isOutgoing ? 'Outgoing' : 'Incoming');
            const statusColor = isMissed ? '#ea0038' : '#00a884';
            const dur = formatCallDuration(rec.duration);
            const dateStr = new Date(rec.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="call-history-card">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <img src="${peerAvatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid ${statusColor};">
                        <div>
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">${peerName}</div>
                            <div style="font-size: 0.8rem; color: ${statusColor}; font-weight: 600;">
                                ${icon} ${statusLabel} ${dur ? '· ' + dur : ''}
                            </div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${dateStr}</div>
                        </div>
                    </div>
                    <button onclick="startCallWithPeer('${peer?._id || ''}', '${peer?.username || ''}', '${peerAvatar}')" style="background: var(--spotlite-gradient); color: #000; border: none; border-radius: 20px; padding: 8px 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        ${icon} Redial
                    </button>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.warn('Load call history error:', err);
    }
}

window.activeChatRecipient = null;
window.activeChatReceiverId = null;
window.activeGroupId = null;
window.activeGroup = null;
window.pendingChatAttachment = null;

window.openChatWithUser = async function(user) {
    if (!user) return;
    if (user.isGroup || user.members) {
        return openChatWithGroup(user);
    }
    window.activeChatRecipient = user;
    window.activeChatReceiverId = user._id || user.id;
    window.activeGroupId = null;
    window.activeGroup = null;

    const emptyState = document.getElementById('chat-empty-state');
    const activeWindow = document.getElementById('chat-window-active');
    const avatarImg = document.getElementById('active-chat-avatar');
    const usernameSpan = document.getElementById('active-chat-username');
    const backBtn = document.getElementById('mobile-back-to-inbox-btn');

    if (emptyState) emptyState.style.cssText = 'display: none !important;';
    if (activeWindow) activeWindow.style.cssText = 'display: flex !important; flex-direction: column; height: 100%;';

    if (avatarImg) avatarImg.src = user.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user.username}`;
    if (usernameSpan) usernameSpan.textContent = `@${user.username}`;
    if (backBtn) backBtn.style.display = 'inline-block';

    if (window.innerWidth <= 768) {
        const inboxPanel = document.querySelector('.messages-inbox');
        if (inboxPanel) inboxPanel.style.display = 'none';
    }

    loadChatThread(window.activeChatReceiverId);
};

window.openChatWithGroup = async function(group) {
    if (!group) return;
    window.activeGroup = group;
    window.activeGroupId = group._id || group.id;
    window.activeChatReceiverId = null;
    window.activeChatRecipient = null;

    const emptyState = document.getElementById('chat-empty-state');
    const activeWindow = document.getElementById('chat-window-active');
    const avatarImg = document.getElementById('active-chat-avatar');
    const usernameSpan = document.getElementById('active-chat-username');
    const backBtn = document.getElementById('mobile-back-to-inbox-btn');

    if (emptyState) emptyState.style.cssText = 'display: none !important;';
    if (activeWindow) activeWindow.style.cssText = 'display: flex !important; flex-direction: column; height: 100%;';

    const groupAvatar = group.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${group.name || group.username || 'Group'}`;
    if (avatarImg) avatarImg.src = groupAvatar;

    const groupName = group.name || group.username || 'Group Chat';
    const memberList = group.members || [];
    const memberNames = memberList.map(m => m.username ? `@${m.username}` : '').filter(Boolean).join(', ');

    if (usernameSpan) {
        usernameSpan.innerHTML = `👥 ${escapeHtml(groupName)} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${memberList.length} members: ${escapeHtml(memberNames)}</span>`;
    }
    if (backBtn) backBtn.style.display = 'inline-block';

    if (window.innerWidth <= 768) {
        const inboxPanel = document.querySelector('.messages-inbox');
        if (inboxPanel) inboxPanel.style.display = 'none';
    }

    loadGroupChatThread(window.activeGroupId);
};

window.loadGroupChatThread = async function(groupId) {
    if (!groupId) return;
    const thread = document.getElementById('active-chat-thread');
    if (!thread) return;

    try {
        const res = await fetch(`${API_BASE}/messages/group/${groupId}`, { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const messages = data.messages || [];
        const group = data.group;
        if (group) window.activeGroup = group;

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const myId = String(currentUser._id || currentUser.id || '');

        thread.innerHTML = '';

        if (!Array.isArray(messages) || messages.length === 0) {
            thread.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; color: var(--text-muted); font-size: 0.88rem;">
                    👋 Group chat <strong>${escapeHtml(group?.name || 'Group')}</strong> created! Say hi to the team.
                </div>
            `;
            return;
        }

        messages.forEach(msg => {
            const sender = msg.sender || {};
            const senderId = String(sender._id || sender.id || msg.sender || '');
            const isMe = senderId === myId;

            const bubbleWrap = document.createElement('div');
            bubbleWrap.style.cssText = `display: flex; flex-direction: column; margin-bottom: 14px; align-items: ${isMe ? 'flex-end' : 'flex-start'};`;

            let mediaContent = '';
            if (msg.fileUrl) {
                if (msg.fileType && msg.fileType.startsWith('image/')) {
                    mediaContent = `<img src="${msg.fileUrl}" style="max-width: 240px; max-height: 200px; border-radius: 12px; margin-bottom: 6px; display: block; cursor: pointer;" onclick="window.open('${msg.fileUrl}', '_blank')">`;
                } else {
                    mediaContent = `<a href="${msg.fileUrl}" target="_blank" style="color: var(--accent-gold); font-weight: 600; text-decoration: underline; font-size: 0.85rem; display: block; margin-bottom: 6px;">📎 ${escapeHtml(msg.fileName || 'Attachment')}</a>`;
                }
            }

            const senderHeader = !isMe ? `
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 0.75rem; font-weight: 700; color: var(--accent-gold);">
                    <img src="${sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${sender.username}`}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">
                    @${escapeHtml(sender.username || 'user')}
                </div>
            ` : '';

            const timeStr = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            bubbleWrap.innerHTML = `
                ${senderHeader}
                <div style="max-width: 78%; padding: 10px 14px; border-radius: ${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background: ${isMe ? 'var(--spotlite-gradient)' : 'var(--bg-card)'}; color: ${isMe ? '#000' : 'var(--text-primary)'}; border: ${isMe ? 'none' : '1px solid var(--border-color)'}; font-size: 0.92rem; font-weight: 500; word-break: break-word; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    ${mediaContent}
                    ${escapeHtml(msg.text || '')}
                    <div style="font-size: 0.7rem; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)'}; margin-top: 4px; text-align: right;">${timeStr}</div>
                </div>
            `;
            thread.appendChild(bubbleWrap);
        });

        thread.scrollTop = thread.scrollHeight;
    } catch (err) {
        console.error('Error loading group thread:', err);
    }
};

window.loadChatThread = async function(receiverId) {
    if (window.activeGroupId) {
        return loadGroupChatThread(window.activeGroupId);
    }
    if (!receiverId) return;
    const thread = document.getElementById('active-chat-thread');
    if (!thread) return;

    try {
        const res = await fetch(`${API_BASE}/messages/${receiverId}`, { headers: getHeaders() });
        if (!res.ok) return;
        const messages = await res.json();

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const myId = String(currentUser._id || currentUser.id || '');

        thread.innerHTML = '';

        if (!Array.isArray(messages) || messages.length === 0) {
            thread.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; color: var(--text-muted); font-size: 0.88rem;">
                    👋 Say hi to <strong>@${escapeHtml(window.activeChatRecipient?.username || 'user')}</strong>!
                </div>
            `;
            return;
        }

        messages.forEach(msg => {
            const senderId = String(msg.sender?._id || msg.sender?.id || msg.sender || '');
            const isMe = senderId === myId;

            const bubbleWrap = document.createElement('div');
            bubbleWrap.style.cssText = `display: flex; flex-direction: column; margin-bottom: 12px; align-items: ${isMe ? 'flex-end' : 'flex-start'};`;

            let mediaContent = '';
            if (msg.fileUrl) {
                if (msg.fileType && msg.fileType.startsWith('image/')) {
                    mediaContent = `<img src="${msg.fileUrl}" style="max-width: 240px; max-height: 200px; border-radius: 12px; margin-bottom: 6px; display: block; cursor: pointer;" onclick="window.open('${msg.fileUrl}', '_blank')">`;
                } else {
                    mediaContent = `<a href="${msg.fileUrl}" target="_blank" style="color: var(--accent-gold); font-weight: 600; text-decoration: underline; font-size: 0.85rem; display: block; margin-bottom: 6px;">📎 ${escapeHtml(msg.fileName || 'Attachment')}</a>`;
                }
            }

            const timeStr = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            bubbleWrap.innerHTML = `
                <div style="max-width: 75%; padding: 10px 14px; border-radius: ${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; background: ${isMe ? 'var(--spotlite-gradient)' : 'var(--bg-card)'}; color: ${isMe ? '#000' : 'var(--text-primary)'}; border: ${isMe ? 'none' : '1px solid var(--border-color)'}; font-size: 0.92rem; font-weight: 500; word-break: break-word; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    ${mediaContent}
                    ${escapeHtml(msg.text || '')}
                    <div style="font-size: 0.7rem; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)'}; margin-top: 4px; text-align: right;">${timeStr}</div>
                </div>
            `;
            thread.appendChild(bubbleWrap);
        });

        thread.scrollTop = thread.scrollHeight;
    } catch (err) {
        console.error('Error loading chat thread:', err);
    }
};

window.sendChatMessage = async function(customText) {
    if (!window.activeChatReceiverId && !window.activeGroupId) {
        if (typeof openNewChatPanel === 'function') {
            openNewChatPanel();
        } else {
            alert('Please select or search for a user or group to message.');
        }
        return;
    }

    const input = document.getElementById('chat-text-input');
    const text = customText !== undefined ? customText : (input ? input.value.trim() : '');
    const attachment = window.pendingChatAttachment;

    if (!text && !attachment) return;

    const thread = document.getElementById('active-chat-thread');
    if (thread) {
        const tempWrap = document.createElement('div');
        tempWrap.style.cssText = 'display: flex; flex-direction: column; margin-bottom: 12px; align-items: flex-end;';
        
        let mediaHtml = '';
        if (attachment && attachment.fileUrl) {
            mediaHtml = `<img src="${attachment.fileUrl}" style="max-width: 240px; max-height: 200px; border-radius: 12px; margin-bottom: 6px;">`;
        }

        tempWrap.innerHTML = `
            <div style="max-width: 75%; padding: 10px 14px; border-radius: 18px 18px 4px 18px; background: var(--spotlite-gradient); color: #000; font-size: 0.92rem; font-weight: 500; word-break: break-word;">
                ${mediaHtml}
                ${escapeHtml(text || '')}
                <div style="font-size: 0.7rem; color: rgba(0,0,0,0.6); margin-top: 4px; text-align: right;">Just now</div>
            </div>
        `;
        thread.appendChild(tempWrap);
        thread.scrollTop = thread.scrollHeight;
    }

    if (input) input.value = '';
    const attachPreview = document.getElementById('chat-attachment-preview');
    if (attachPreview) attachPreview.style.display = 'none';
    window.pendingChatAttachment = null;

    if (typeof playActionSound === 'function') playActionSound('comment');

    try {
        const payload = { text: text || '' };
        if (window.activeGroupId) {
            payload.groupId = window.activeGroupId;
        } else {
            payload.receiverId = window.activeChatReceiverId;
        }

        if (attachment) {
            payload.fileUrl = attachment.fileUrl;
            payload.fileName = attachment.fileName;
            payload.fileType = attachment.fileType;
        }

        const res = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to send message');

        if (window.activeGroupId) {
            loadGroupChatThread(window.activeGroupId);
        } else {
            loadChatThread(window.activeChatReceiverId);
        }
        loadConversationsInbox();
    } catch (err) {
        console.error('Send message error:', err);
    }
};

window.loadConversationsInbox = async function() {
    const list = document.getElementById('conversations-inbox-list');
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE}/messages/conversations`, { headers: getHeaders() });
        if (!res.ok) return;
        const convs = await res.json();

        if (!Array.isArray(convs) || convs.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding: 30px 16px; color: var(--text-muted); font-size: 0.85rem;">
                    No active conversations.<br>Click <strong>New Chat</strong> to message someone!
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        convs.forEach(c => {
            if (c.isGroup && c.group) {
                const g = c.group;
                const row = document.createElement('div');
                const isSelected = window.activeGroupId === (g._id || g.id);
                row.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; background: ${isSelected ? 'rgba(255,203,5,0.1)' : 'transparent'}; transition: background 0.2s;`;
                
                const timeStr = c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const gAvatar = g.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${g.name}`;

                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                        <img src="${gAvatar}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-gold);">
                        <div style="min-width: 0;">
                            <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); display: block;">👥 ${escapeHtml(g.name)}</span>
                            <span style="font-size: 0.78rem; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${escapeHtml(c.lastMessage || 'Group created')}</span>
                        </div>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0;">${timeStr}</span>
                `;

                row.onclick = () => openChatWithGroup(g);
                list.appendChild(row);
            } else if (c.user) {
                const u = c.user;
                const row = document.createElement('div');
                const isSelected = window.activeChatReceiverId === (u._id || u.id);
                row.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; background: ${isSelected ? 'rgba(255,203,5,0.1)' : 'transparent'}; transition: background 0.2s;`;
                
                const timeStr = c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                        <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-gold);">
                        <div style="min-width: 0;">
                            <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); display: block;">@${escapeHtml(u.username)}</span>
                            <span style="font-size: 0.78rem; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${escapeHtml(c.lastMessage || 'Sent attachment')}</span>
                        </div>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0;">${timeStr}</span>
                `;

                row.onclick = () => openChatWithUser(u);
                list.appendChild(row);
            }
        });
    } catch (err) {
        console.error('Error loading conversations inbox:', err);
    }
};

window.openNewChatPanel = async function() {
    let overlay = document.getElementById('new-chat-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'new-chat-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: "Inter", sans-serif;';
        overlay.innerHTML = `
            <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 20px; width: 90%; max-width: 440px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.6);">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Start New Chat 💬</h3>
                    <button onclick="document.getElementById('new-chat-modal-overlay').style.display='none'" style="background: none; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer;">✕</button>
                </div>
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                    <input type="text" id="new-chat-search-input" placeholder="🔍 Search user by username..." style="width: 100%; padding: 10px 14px; border-radius: 24px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.9rem; outline: none;">
                </div>
                <div id="new-chat-users-list" style="flex: 1; overflow-y: auto; padding: 10px 0; max-height: 380px;">
                    <div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading users...</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        };
    } else {
        overlay.style.display = 'flex';
    }

    const searchInput = document.getElementById('new-chat-search-input');
    const usersList = document.getElementById('new-chat-users-list');
    if (searchInput) searchInput.value = '';

    try {
        const res = await fetch(`${API_BASE}/users/all`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const allUsers = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : (data?.users || []));

        const renderUsers = async (filter = '') => {
            let listToDisplay = allUsers;

            if (filter.trim()) {
                try {
                    const searchRes = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(filter.trim())}`, { headers: getHeaders() });
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        if (Array.isArray(searchData) && searchData.length > 0) {
                            listToDisplay = searchData;
                        } else {
                            listToDisplay = allUsers.filter(u => (u.username || '').toLowerCase().includes(filter.toLowerCase()));
                        }
                    }
                } catch (e) {
                    listToDisplay = allUsers.filter(u => (u.username || '').toLowerCase().includes(filter.toLowerCase()));
                }
            }

            if (!listToDisplay || listToDisplay.length === 0) {
                usersList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No users found</div>';
                return;
            }

            usersList.innerHTML = listToDisplay.map(u => {
                const avatar = u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`;
                return `
                    <div class="new-chat-user-row" data-id="${u._id || u.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${avatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-gold);">
                            <div>
                                <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">@${escapeHtml(u.username)}</div>
                                <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(u.bio || 'Spotlite User')}</div>
                            </div>
                        </div>
                        <button style="background: var(--spotlite-gradient); color: #000; border: none; border-radius: 20px; padding: 6px 14px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Chat</button>
                    </div>
                `;
            }).join('');

            usersList.querySelectorAll('.new-chat-user-row').forEach(row => {
                row.onclick = () => {
                    const id = row.getAttribute('data-id');
                    const targetUser = listToDisplay.find(u => (u._id || u.id) === id);
                    if (targetUser) {
                        overlay.style.display = 'none';
                        openChatWithUser(targetUser);
                    }
                };
            });
        };

        renderUsers('');
        if (searchInput) {
            let debounceTimer = null;
            searchInput.oninput = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => renderUsers(searchInput.value), 250);
            };
        }
    } catch (err) {
        if (usersList) usersList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--accent-red); font-size: 0.85rem;">Failed to load users</div>';
    }
};

window.openGroupChatModal = function() {
    let modal = document.getElementById('group-chat-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'group-chat-modal-overlay';
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: "Inter", sans-serif;';
        modal.innerHTML = `
            <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 20px; width: 90%; max-width: 440px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.6);">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Create Group Chat 👥</h3>
                    <button id="close-group-modal-btn" onclick="document.getElementById('group-chat-modal-overlay').style.display='none'" style="background: none; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer;">✕</button>
                </div>
                <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 10px;">
                    <input type="text" id="group-name-input" placeholder="Group Name (e.g. Project Team)..." style="width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.9rem; outline: none;">
                    <input type="text" id="group-search-user-input" placeholder="🔍 Search members..." style="width: 100%; padding: 8px 14px; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.85rem; outline: none;">
                </div>
                <div id="group-user-selection-list" style="flex: 1; overflow-y: auto; padding: 10px 16px; max-height: 300px;">
                    <div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading users...</div>
                </div>
                <div style="padding: 14px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancel-group-modal-btn" onclick="document.getElementById('group-chat-modal-overlay').style.display='none'" style="background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 20px; padding: 8px 18px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button id="submit-create-group-btn" style="background: var(--spotlite-gradient); color: #000; border: none; border-radius: 20px; padding: 8px 22px; font-weight: 700; cursor: pointer;">Create Group ✨</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }
    setupGroupChatModal();
};

window.initMessagesPage = function() {
    loadConversationsInbox();

    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = urlParams.get('u');
    if (targetUsername) {
        fetch(`${API_BASE}/users/profile/${targetUsername}`)
            .then(res => res.json())
            .then(data => {
                if (data.user) openChatWithUser(data.user);
            })
            .catch(e => console.error('Failed to load user profile for chat:', e));
    }

    const sendBtn = document.getElementById('chat-send-btn');
    const textInput = document.getElementById('chat-text-input');
    const heartBtn = document.getElementById('chat-quick-heart-btn');
    const attachBtn = document.getElementById('chat-attach-file-btn');
    const fileInput = document.getElementById('chat-file-input');
    const removeAttachBtn = document.getElementById('chat-attachment-remove-btn');
    const backBtn = document.getElementById('mobile-back-to-inbox-btn');

    const startAudioBtn = document.getElementById('start-audio-call-btn');
    const startVideoBtn = document.getElementById('start-video-call-btn');
    const emptyNewChatBtn = document.getElementById('empty-state-new-chat-btn');
    const inboxNewChatBtn = document.getElementById('inbox-new-chat-btn');
    const inboxNewGroupBtn = document.getElementById('inbox-new-group-btn');

    if (startAudioBtn) startAudioBtn.onclick = () => { window._lastCallType = 'audio'; if (typeof startWebRTCCall === 'function') startWebRTCCall(true); };
    if (startVideoBtn) startVideoBtn.onclick = () => { window._lastCallType = 'video'; if (typeof startWebRTCCall === 'function') startWebRTCCall(false); };
    if (emptyNewChatBtn) emptyNewChatBtn.onclick = () => openNewChatPanel();
    if (inboxNewChatBtn) inboxNewChatBtn.onclick = () => openNewChatPanel();
    if (inboxNewGroupBtn) inboxNewGroupBtn.onclick = () => openGroupChatModal();

    if (sendBtn) sendBtn.onclick = () => sendChatMessage();
    if (textInput) {
        textInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        };
    }
    if (heartBtn) heartBtn.onclick = () => sendChatMessage('❤️');

    if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            fileToBase64(file).then(base64 => {
                window.pendingChatAttachment = {
                    fileUrl: base64,
                    fileName: file.name,
                    fileType: file.type
                };
                const preview = document.getElementById('chat-attachment-preview');
                const nameSpan = document.getElementById('chat-attachment-name');
                if (preview) preview.style.display = 'flex';
                if (nameSpan) nameSpan.textContent = file.name;
            });
        };
    }

    if (removeAttachBtn) {
        removeAttachBtn.onclick = () => {
            window.pendingChatAttachment = null;
            const preview = document.getElementById('chat-attachment-preview');
            if (preview) preview.style.display = 'none';
        };
    }

    if (backBtn) {
        backBtn.onclick = () => {
            const inboxPanel = document.querySelector('.messages-inbox');
            if (inboxPanel) inboxPanel.style.display = 'block';
            const activeWindow = document.getElementById('chat-window-active');
            if (activeWindow) activeWindow.style.cssText = 'display: none !important;';
            const emptyState = document.getElementById('chat-empty-state');
            if (emptyState) emptyState.style.cssText = 'display: flex !important;';
        };
    }

    // Auto refresh active chat thread every 3 seconds
    if (!window._messagesAutoRefreshInterval) {
        window._messagesAutoRefreshInterval = setInterval(() => {
            if (window.activeChatReceiverId && window.location.pathname.includes('messages')) {
                loadChatThread(window.activeChatReceiverId);
                loadConversationsInbox();
            }
        }, 3000);
    }
};

function setupGroupChatModal() {
    const openBtn = document.getElementById('inbox-new-group-btn');
    const modal = document.getElementById('group-chat-modal-overlay');
    const closeBtn = document.getElementById('close-group-modal-btn');
    const cancelBtn = document.getElementById('cancel-group-modal-btn');
    const submitBtn = document.getElementById('submit-create-group-btn');
    const selectionList = document.getElementById('group-user-selection-list');
    const nameInput = document.getElementById('group-name-input');
    const filterInput = document.getElementById('group-search-user-input');

    if (!modal) return;

    let availableUsers = [];
    const selectedUserIds = new Set();

    async function loadUsersForGroup() {
        if (!selectionList) return;
        selectionList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:12px;">Loading users...</p>';
        try {
            const res = await fetch(`${API_BASE}/users/all`, { headers: getHeaders() });
            const data = await res.json();
            availableUsers = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : (data?.users || []));
            renderUserSelection('');
        } catch (err) {
            selectionList.innerHTML = '<p style="color:var(--accent-red); text-align:center; padding:12px;">Failed to load users.</p>';
        }
    }

    function renderUserSelection(filter) {
        if (!selectionList) return;
        selectionList.innerHTML = '';
        const filtered = availableUsers.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            selectionList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:12px;">No users found.</p>';
            return;
        }

        filtered.forEach(u => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;';
            const isChecked = selectedUserIds.has(u._id || u.id);
            label.innerHTML = `
                <input type="checkbox" value="${u._id || u.id}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent-gold);">
                <img src="${u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="">
                <span style="font-size:0.88rem;color:var(--text-primary);font-weight:600;">${escapeHtml(u.username)}</span>
            `;
            const checkbox = label.querySelector('input');
            checkbox.onchange = (e) => {
                if (e.target.checked) selectedUserIds.add(u._id || u.id);
                else selectedUserIds.delete(u._id || u.id);
            };
            selectionList.appendChild(label);
        });
    }

    if (filterInput) {
        filterInput.oninput = (e) => renderUserSelection(e.target.value.trim());
    }

    selectedUserIds.clear();
    if (nameInput) nameInput.value = '';
    if (filterInput) filterInput.value = '';
    loadUsersForGroup();

    function closeModal() {
        modal.style.display = 'none';
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    if (submitBtn) {
        submitBtn.onclick = async () => {
            const groupName = nameInput ? nameInput.value.trim() : '';
            if (!groupName) return alert('Please enter a group name.');
            if (selectedUserIds.size === 0) return alert('Please select at least 1 member for your group.');

            try {
                const res = await fetch(`${API_BASE}/messages/groups/create`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        name: groupName,
                        memberIds: Array.from(selectedUserIds)
                    })
                });
                const groupData = await res.json();
                if (!res.ok) throw new Error(groupData.error || 'Group creation failed');

                closeModal();
                if (typeof showToast === 'function') showToast(`🎉 Group "${groupName}" created!`);
                if (typeof loadConversationsInbox === 'function') await loadConversationsInbox();
                if (typeof openChatWithGroup === 'function') openChatWithGroup(groupData);
            } catch (err) {
                alert(err.message || 'Failed to create group chat.');
            }
        };
    }
}

// ── GLOBAL NAVIGATION LISTENERS ──
window.setupGlobalNavigationListeners = function() {
    // --- Search slider ---
    const searchBtns = document.querySelectorAll('#sidebar-search-btn, #mobile-search-btn');
    const searchPanel = document.getElementById('search-slider-panel');
    const closeSearchBtn = document.getElementById('close-search-panel-btn');
    searchBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (searchPanel) {
                searchPanel.classList.toggle('active');
                if (searchPanel.classList.contains('active') && typeof setupSearchSliderPanel === 'function') {
                    setupSearchSliderPanel();
                }
            }
        };
    });
    if (closeSearchBtn && searchPanel) closeSearchBtn.onclick = () => searchPanel.classList.remove('active');

    // --- Notifications slider ---
    const notifBtns = document.querySelectorAll('#sidebar-notifications-btn, #mobile-notifications-btn');
    const notifPanel = document.getElementById('notifications-slider-panel');
    const closeNotifBtn = document.getElementById('close-notifications-slider-btn');
    notifBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (notifPanel) {
                notifPanel.classList.toggle('active');
                if (notifPanel.classList.contains('active') && typeof loadNotifications === 'function') loadNotifications();
            }
        };
    });
    if (closeNotifBtn && notifPanel) closeNotifBtn.onclick = () => notifPanel.classList.remove('active');

    // --- Settings modal ---
    const settingsBtns = document.querySelectorAll('#open-settings-btn, #mobile-settings-btn');
    const settingsModal = document.getElementById('settings-modal') || document.getElementById('settings-modal-overlay');
    const closeSettingsBtns = document.querySelectorAll('#close-settings-modal-btn, #close-settings-btn');
    settingsBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (settingsModal) settingsModal.style.cssText = 'display: flex !important; z-index: 999999;';
        };
    });
    closeSettingsBtns.forEach(btn => {
        btn.onclick = () => {
            if (settingsModal) settingsModal.style.cssText = 'display: none !important;';
        };
    });

    // Save settings
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = () => {
            if (settingsModal) settingsModal.style.cssText = 'display: none !important;';
            if (typeof showSpotliteToast === 'function') showSpotliteToast('Settings saved!');
        };
    }

    // Theme accent buttons
    document.querySelectorAll('.theme-accent-opt').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.theme-accent-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            if (theme === 'gold') {
                document.documentElement.style.setProperty('--accent-gold', '#ffcb05');
                document.documentElement.style.setProperty('--spotlite-gradient', 'linear-gradient(135deg, #ffcb05 0%, #f7971e 100%)');
            } else if (theme === 'purple') {
                document.documentElement.style.setProperty('--accent-gold', '#a855f7');
                document.documentElement.style.setProperty('--spotlite-gradient', 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)');
            } else if (theme === 'emerald') {
                document.documentElement.style.setProperty('--accent-gold', '#10b981');
                document.documentElement.style.setProperty('--spotlite-gradient', 'linear-gradient(135deg, #10b981 0%, #059669 100%)');
            }
            if (typeof showSpotliteToast === 'function') showSpotliteToast('Theme updated!');
        };
    });

    // --- Create post modal ---
    const createBtns = document.querySelectorAll('#open-create-btn, #mobile-open-create-btn, #sidebar-create-btn, .bottom-create-btn, .quick-post-input-box, .quick-post-btn, [aria-label="Create Post"]');
    const createModal = document.getElementById('create-post-modal-overlay');
    const closeCreateBtn = document.getElementById('close-create-modal');
    createBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (createModal) {
                createModal.style.cssText = 'display: flex !important; z-index: 999999;';
                createModal.classList.add('active');
                if (typeof setupCreatePostModal === 'function') setupCreatePostModal();
            }
        };
    });
    if (closeCreateBtn && createModal) {
        closeCreateBtn.onclick = () => {
            createModal.style.cssText = 'display: none !important;';
            createModal.classList.remove('active');
        };
    }
    if (createModal) {
        createModal.onclick = (e) => {
            if (e.target === createModal) {
                createModal.style.cssText = 'display: none !important;';
                createModal.classList.remove('active');
            }
        };
    }

    // --- Profile links ---
    const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const profileLinks = document.querySelectorAll('#sidebar-profile-link, #mobile-profile-link');
    profileLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const username = loggedUser.username;
            if (username) window.location.href = `profile.html?user=${username}`;
        };
    });

    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'auth.html';
        };
    }

    // --- Group chat button ---
    const groupBtn = document.getElementById('inbox-new-group-btn');
    if (groupBtn) {
        groupBtn.onclick = (e) => {
            e.preventDefault();
            if (typeof window.openGroupChatModal === 'function') window.openGroupChatModal();
        };
    }

    // --- New chat button ---
    const newChatBtn = document.getElementById('inbox-new-chat-btn');
    if (newChatBtn) {
        newChatBtn.onclick = (e) => {
            e.preventDefault();
            if (typeof window.openNewChatPanel === 'function') window.openNewChatPanel();
        };
    }
};

window.initMessagesPage = function() {
    window.setupGlobalNavigationListeners();
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'auth.html'; return; }

    // Load conversations inbox
    if (typeof loadConversationsInbox === 'function') loadConversationsInbox();

    // Wire send button + enter key
    const sendBtn = document.getElementById('chat-send-btn');
    const textInput = document.getElementById('chat-text-input');
    const heartBtn = document.getElementById('chat-quick-heart-btn');
    const attachBtn = document.getElementById('chat-attach-file-btn');
    const fileInput = document.getElementById('chat-file-input');
    const removeAttachBtn = document.getElementById('chat-attachment-remove-btn');
    const backBtn = document.getElementById('mobile-back-to-inbox-btn');
    const startAudioBtn = document.getElementById('start-audio-call-btn');
    const startVideoBtn = document.getElementById('start-video-call-btn');
    const newChatBtn = document.getElementById('inbox-new-chat-btn');

    if (sendBtn) sendBtn.onclick = () => { if (typeof sendChatMessage === 'function') sendChatMessage(); };
    if (textInput) {
        textInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (typeof sendChatMessage === 'function') sendChatMessage();
            }
        };
    }
    if (heartBtn) heartBtn.onclick = () => { if (typeof sendChatMessage === 'function') sendChatMessage('❤️'); };
    if (newChatBtn) newChatBtn.onclick = () => { if (typeof openNewChatPanel === 'function') openNewChatPanel(); };

    if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                window.pendingChatAttachment = { fileUrl: ev.target.result, fileName: file.name, fileType: file.type };
                const preview = document.getElementById('chat-attachment-preview');
                const nameSpan = document.getElementById('chat-attachment-name');
                if (preview) preview.style.display = 'flex';
                if (nameSpan) nameSpan.textContent = file.name;
            };
            reader.readAsDataURL(file);
        };
    }

    if (removeAttachBtn) {
        removeAttachBtn.onclick = () => {
            window.pendingChatAttachment = null;
            const preview = document.getElementById('chat-attachment-preview');
            if (preview) preview.style.display = 'none';
        };
    }

    if (backBtn) {
        backBtn.onclick = () => {
            const inboxPanel = document.querySelector('.messages-inbox');
            if (inboxPanel) inboxPanel.style.display = '';
            const activeWindow = document.getElementById('chat-window-active');
            if (activeWindow) activeWindow.style.cssText = 'display: none !important;';
        };
    }

    if (startAudioBtn) startAudioBtn.onclick = () => { window._lastCallType = 'audio'; if (typeof startWebRTCCall === 'function') startWebRTCCall(true); };
    if (startVideoBtn) startVideoBtn.onclick = () => { window._lastCallType = 'video'; if (typeof startWebRTCCall === 'function') startWebRTCCall(false); };

    // Inbox search filter
    const inboxSearchInput = document.getElementById('inbox-search-input');
    if (inboxSearchInput) {
        inboxSearchInput.oninput = () => {
            const query = inboxSearchInput.value.trim().toLowerCase();
            document.querySelectorAll('#conversations-inbox-list > div').forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
            });
        };
    }

    // Auto-refresh chat every 3s
    clearInterval(window._msgAutoRefresh);
    window._msgAutoRefresh = setInterval(() => {
        if (window.activeChatReceiverId) {
            if (typeof loadChatThread === 'function') loadChatThread(window.activeChatReceiverId);
        }
        if (typeof loadConversationsInbox === 'function') loadConversationsInbox();
    }, 3000);

    // Open chat from URL param ?u=username
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('u');
    if (targetUser) {
        fetch(`${API_BASE}/users/profile/${targetUser}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(d => { if (d && d.user && typeof openChatWithUser === 'function') openChatWithUser(d.user); })
            .catch(() => {});
    }
};

window.currentProfileUserId = null;
window.currentProfileStories = [];

window.initProfilePage = async function() {
    window.setupGlobalNavigationListeners();
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = urlParams.get('user') || urlParams.get('username');
    const loggedUser = JSON.parse(localStorage.getItem('user')) || {};

    try {
        let profileUser = loggedUser;
        if (targetUsername && targetUsername.toLowerCase() !== (loggedUser.username || '').toLowerCase()) {
            const res = await fetch(`${API_BASE}/users/profile/${targetUsername}`, { headers: getHeaders() });
            if (res.ok) profileUser = await res.json();
        }

        window.currentProfileUserId = profileUser._id || profileUser.id;

        const heading = document.getElementById('profile-username-heading');
        const avatarImg = document.getElementById('profile-user-avatar');
        const fullname = document.getElementById('profile-fullname');
        const bioText = document.getElementById('profile-bio-text');
        const editBtn = document.getElementById('open-edit-profile-btn');
        const addStoryBtn = document.getElementById('open-add-story-btn');

        if (heading) heading.textContent = profileUser.username || 'user';
        if (avatarImg) avatarImg.src = profileUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${profileUser.username}`;
        if (fullname) fullname.textContent = profileUser.fullName || profileUser.username || 'Spotlite Member';
        if (bioText) bioText.textContent = profileUser.bio || 'No bio yet.';

        const isOwnProfile = (!targetUsername || profileUser._id === loggedUser.id || profileUser._id === loggedUser._id || profileUser.username === loggedUser.username);
        if (isOwnProfile) {
            if (editBtn) editBtn.style.display = 'inline-block';
            if (addStoryBtn) addStoryBtn.style.display = 'inline-block';
        }

        await window.checkUserProfileStories(window.currentProfileUserId);

        if (typeof setupAddStoryModal === 'function') {
            setupAddStoryModal();
        }
    } catch (e) {
        console.error('Failed to init profile page:', e);
    }
};

window.checkUserProfileStories = async function(userId) {
    const ring = document.getElementById('profile-avatar-story-ring');
    if (!ring || !userId) return;
    try {
        const res = await fetch(`${API_BASE}/users/${userId}/stories`, { headers: getHeaders() });
        if (res.ok) {
            window.currentProfileStories = await res.json();
            if (window.currentProfileStories && window.currentProfileStories.length > 0) {
                ring.classList.add('has-active-story');
                ring.style.cssText = 'cursor: pointer; position: relative; display: inline-block; padding: 4px; border-radius: 50%; border: 3px solid var(--accent-gold); box-shadow: 0 0 16px rgba(255,203,5,0.7); transition: transform 0.2s;';
            } else {
                ring.classList.remove('has-active-story');
                ring.style.cssText = 'cursor: pointer; position: relative; display: inline-block; padding: 4px; border-radius: 50%; border: 3px solid transparent;';
            }
        }
    } catch (e) {
        console.error('Failed to check user stories:', e);
    }
};

window.handleProfileAvatarClick = async function() {
    const loggedUser = JSON.parse(localStorage.getItem('user')) || {};
    const isOwnProfile = !window.currentProfileUserId || window.currentProfileUserId === loggedUser.id || window.currentProfileUserId === loggedUser._id;

    if (window.currentProfileStories && window.currentProfileStories.length > 0) {
        window.openStoryViewerModal(window.currentProfileStories);
    } else if (isOwnProfile) {
        window.openAddStoryModal();
    } else {
        const avatarImg = document.getElementById('profile-user-avatar');
        if (avatarImg && avatarImg.src && typeof window.openAvatarViewer === 'function') {
            window.openAvatarViewer(avatarImg.src);
        }
    }
};

window.openAddStoryModal = function() {
    let modal = document.getElementById('add-story-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-story-modal-overlay';
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: "Inter", sans-serif;';
        modal.innerHTML = `
            <div style="background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: 24px; width: 90%; max-width: 440px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.8); display: flex; flex-direction: column;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); background: rgba(255,203,5,0.05);">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--accent-gold);">Create Instagram Story ⚡</h3>
                    <button id="close-add-story-btn" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">✕</button>
                </div>
                <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                    <div id="story-media-preview-container" style="width: 100%; height: 240px; background: var(--bg-input); border: 2px dashed var(--border-color); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative;" title="Click to select photo or video">
                        <div id="story-preview-placeholder" style="text-align: center; color: var(--text-muted); padding: 20px;">
                            <div style="font-size: 2.5rem; margin-bottom: 8px;">📸</div>
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">Select Photo or Video</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">Click to upload (JPG, PNG, MP4, GIF)</div>
                        </div>
                        <img id="story-preview-img" style="display: none; width: 100%; height: 100%; object-fit: contain; background: #000;">
                        <video id="story-preview-video" controls autoplay loop style="display: none; width: 100%; height: 100%; object-fit: contain; background: #000;"></video>
                    </div>
                    <input type="file" id="story-file-input" accept="image/*,video/*" style="display: none;">
                    
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Or Direct Image / Video URL:</label>
                        <input type="text" id="story-direct-url-input" placeholder="https://example.com/story.jpg" style="width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.88rem; outline: none;">
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Story Caption / Text Overlay:</label>
                        <input type="text" id="story-caption-input" placeholder="Write something cool... ✨" maxlength="100" style="width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.88rem; outline: none;">
                    </div>

                    <div id="story-upload-error" style="display: none; color: var(--accent-red); font-size: 0.82rem; text-align: center;"></div>
                </div>

                <div style="padding: 14px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-primary);">
                    <button id="cancel-add-story-btn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 20px; padding: 8px 18px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button id="submit-add-story-btn" style="background: var(--spotlite-gradient); color: #000; border: none; border-radius: 20px; padding: 8px 22px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(255,203,5,0.3);">Share to Story ⚡</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }

    const previewContainer = document.getElementById('story-media-preview-container');
    const fileInput = document.getElementById('story-file-input');
    const placeholder = document.getElementById('story-preview-placeholder');
    const previewImg = document.getElementById('story-preview-img');
    const previewVid = document.getElementById('story-preview-video');
    const directUrlInput = document.getElementById('story-direct-url-input');
    const captionInput = document.getElementById('story-caption-input');
    const errorEl = document.getElementById('story-upload-error');
    const submitBtn = document.getElementById('submit-add-story-btn');
    const closeBtn = document.getElementById('close-add-story-btn');
    const cancelBtn = document.getElementById('cancel-add-story-btn');

    let pendingMediaBase64 = null;

    if (errorEl) errorEl.style.display = 'none';
    if (captionInput) captionInput.value = '';
    if (directUrlInput) directUrlInput.value = '';
    if (fileInput) fileInput.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (previewImg) { previewImg.style.display = 'none'; previewImg.src = ''; }
    if (previewVid) { previewVid.style.display = 'none'; previewVid.src = ''; }

    if (previewContainer && fileInput) {
        previewContainer.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                if (file.type.startsWith('video/')) {
                    pendingMediaBase64 = await fileToBase64(file);
                    if (previewVid) {
                        previewVid.src = pendingMediaBase64;
                        previewVid.style.display = 'block';
                    }
                    if (previewImg) previewImg.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'none';
                } else {
                    if (typeof compressImage === 'function') {
                        pendingMediaBase64 = await compressImage(file, 800, 1200, 0.85);
                    } else {
                        pendingMediaBase64 = await fileToBase64(file);
                    }
                    if (previewImg) {
                        previewImg.src = pendingMediaBase64;
                        previewImg.style.display = 'block';
                    }
                    if (previewVid) previewVid.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'none';
                }
            } catch (err) {
                console.error('Story media upload error:', err);
            }
        };
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    if (submitBtn) {
        submitBtn.onclick = async () => {
            const mediaUrl = pendingMediaBase64 || (directUrlInput ? directUrlInput.value.trim() : '');
            const caption = captionInput ? captionInput.value.trim() : '';

            if (!mediaUrl && !caption) {
                if (errorEl) {
                    errorEl.textContent = 'Please select an image/video or enter a caption for your story.';
                    errorEl.style.display = 'block';
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sharing... ⚡';

            try {
                const res = await fetch(`${API_BASE}/users/stories`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ image: mediaUrl, caption })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to share story');

                closeModal();
                if (typeof showToast === 'function') showToast('Story shared to your profile! 🌟');

                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const myId = currentUser._id || currentUser.id;
                if (typeof checkUserProfileStories === 'function') {
                    checkUserProfileStories(myId);
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Error sharing story.';
                    errorEl.style.display = 'block';
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Share to Story ⚡';
            }
        };
    }
};

window.openStoryViewerModal = function(stories, startIndex = 0) {
    if (!stories || !Array.isArray(stories) || stories.length === 0) return;

    let existingModal = document.getElementById('story-viewer-modal');
    if (existingModal) existingModal.remove();

    let currentIndex = startIndex;
    let storyTimer = null;

    const modal = document.createElement('div');
    modal.id = 'story-viewer-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display: flex !important; z-index: 999999; background: rgba(0,0,0,0.94); align-items: center; justify-content: center; backdrop-filter: blur(16px);';

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myId = String(currentUser._id || currentUser.id || '');

    const renderViewer = () => {
        const s = stories[currentIndex];
        if (!s) { modal.remove(); return; }

        const author = s.author || { username: 'user' };
        const authorId = String(author._id || author.id || s.author || '');
        const isOwner = (authorId === myId || currentUser.isAdmin);

        const progressBarsHtml = stories.map((_, i) => `
            <div style="flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
                <div id="story-progress-bar-${i}" style="height: 100%; width: ${i < currentIndex ? '100%' : '0%'}; background: var(--accent-gold); transition: width ${i === currentIndex ? '5s linear' : '0s'};"></div>
            </div>
        `).join('');

        const avatar = author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${author.username}`;
        const timeAgo = s.createdAt ? formatTime(s.createdAt) : '';

        const likesArr = s.likes || [];
        const isLikedByMe = likesArr.some(id => String(id) === myId);

        modal.innerHTML = `
            <div style="position: relative; max-width: 420px; width: 92%; height: 90vh; max-height: 720px; background: #000; border: 1.5px solid var(--accent-gold); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.95); display: flex; flex-direction: column;">
                
                <!-- Multi-segment Story Progress Bar -->
                <div style="display: flex; gap: 4px; padding: 10px 14px 4px 14px; position: absolute; top: 0; left: 0; right: 0; z-index: 20; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);">
                    ${progressBarsHtml}
                </div>

                <!-- Story Author Info Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 16px 10px 16px; position: absolute; top: 12px; left: 0; right: 0; z-index: 20; background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.location.href='profile.html?u=${author.username}'">
                        <img src="${avatar}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--accent-gold); object-fit: cover;">
                        <div>
                            <span style="color: #fff; font-weight: 700; font-size: 0.95rem; display: block;">@${escapeHtml(author.username)}</span>
                            <span style="color: rgba(255,255,255,0.7); font-size: 0.72rem; font-weight: 500;">${timeAgo}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${isOwner ? `<button id="sv-delete-btn" style="background: rgba(234,0,56,0.3); color: #ff3838; border: 1px solid #ff3838; border-radius: 14px; padding: 4px 10px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">Delete 🗑️</button>` : ''}
                        <button id="sv-close-btn" style="background: none; border: none; color: #fff; font-size: 1.6rem; cursor: pointer; line-height: 1;">✕</button>
                    </div>
                </div>

                <!-- Story Media Display -->
                <div style="flex: 1; position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000;">
                    ${(s.image && (s.image.startsWith('data:video') || s.image.match(/\.(mp4|webm)/i))) ? 
                    `<video src="${s.image}" autoplay loop playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>` :
                    `<img src="${s.image || avatar}" style="width: 100%; height: 100%; object-fit: contain;">`}
                    
                    <!-- Left / Right Tap Controls -->
                    <div id="sv-tap-left" style="position: absolute; top: 60px; left: 0; width: 40%; bottom: 100px; z-index: 15; cursor: pointer;"></div>
                    <div id="sv-tap-right" style="position: absolute; top: 60px; right: 0; width: 40%; bottom: 100px; z-index: 15; cursor: pointer;"></div>

                    <!-- Story Caption Text Overlay -->
                    ${s.caption ? `
                    <div style="position: absolute; bottom: 95px; left: 16px; right: 16px; z-index: 20; background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 16px; padding: 10px 16px; text-align: center;">
                        <p style="color: #fff; font-size: 0.92rem; font-weight: 600; margin: 0; font-family: 'Outfit', sans-serif;">${escapeHtml(s.caption)}</p>
                    </div>
                    ` : ''}
                </div>

                <!-- Instagram-style Quick Emoji Reactions & DM Reply Bar -->
                <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 25; padding: 10px 14px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7)); border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                    <!-- Quick Emoji Reactions -->
                    <div style="display: flex; align-items: center; justify-content: space-around;">
                        <span class="sv-emoji-btn" data-emoji="🔥" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 🔥">🔥</span>
                        <span class="sv-emoji-btn" data-emoji="😂" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 😂">😂</span>
                        <span class="sv-emoji-btn" data-emoji="😍" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 😍">😍</span>
                        <span class="sv-emoji-btn" data-emoji="👏" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 👏">👏</span>
                        <span class="sv-emoji-btn" data-emoji="😮" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 😮">😮</span>
                        <span class="sv-emoji-btn" data-emoji="💯" style="font-size: 1.35rem; cursor: pointer; transition: transform 0.15s;" title="React 💯">💯</span>
                    </div>

                    <!-- DM Reply & Like Controls -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="text" id="sv-reply-input" placeholder="Send message to @${escapeHtml(author.username)}..." style="flex: 1; padding: 8px 14px; border-radius: 24px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.12); color: #fff; font-size: 0.85rem; outline: none;">
                        <button id="sv-reply-send-btn" style="background: var(--spotlite-gradient); color: #000; border: none; border-radius: 20px; padding: 6px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; flex-shrink: 0;">Send</button>
                        <button id="sv-like-btn" style="background: none; border: none; color: ${isLikedByMe ? '#ff3838' : '#ffffff'}; font-size: 1.4rem; cursor: pointer; transition: transform 0.2s;" title="Like Story">
                            ${isLikedByMe ? '❤️' : '🤍'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        clearTimeout(storyTimer);
        setTimeout(() => {
            const bar = document.getElementById(`story-progress-bar-${currentIndex}`);
            if (bar) bar.style.width = '100%';
        }, 50);

        storyTimer = setTimeout(() => {
            if (currentIndex < stories.length - 1) {
                currentIndex++;
                renderViewer();
            } else {
                modal.remove();
            }
        }, 5000);

        document.getElementById('sv-close-btn').onclick = () => { clearTimeout(storyTimer); modal.remove(); };

        // Story Like Button Event
        const likeBtn = document.getElementById('sv-like-btn');
        if (likeBtn) {
            likeBtn.onclick = async () => {
                try {
                    const res = await fetch(`${API_BASE}/users/stories/${s._id}/like`, {
                        method: 'POST',
                        headers: getHeaders()
                    });
                    const resData = await res.json();
                    if (res.ok) {
                        likeBtn.textContent = resData.isLiked ? '❤️' : '🤍';
                        likeBtn.style.color = resData.isLiked ? '#ff3838' : '#ffffff';
                        if (typeof showToast === 'function') showToast(resData.isLiked ? 'Liked story ❤️' : 'Unliked story');
                    }
                } catch (e) {}
            };
        }

        // Emoji Reaction Events
        modal.querySelectorAll('.sv-emoji-btn').forEach(btn => {
            btn.onclick = async () => {
                const emoji = btn.getAttribute('data-emoji');
                btn.style.transform = 'scale(1.4)';
                setTimeout(() => btn.style.transform = 'scale(1)', 200);

                try {
                    const res = await fetch(`${API_BASE}/users/stories/${s._id}/react`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ emoji })
                    });
                    if (res.ok) {
                        if (typeof showToast === 'function') showToast(`Sent ${emoji} to @${author.username}! ✨`);
                    }
                } catch (e) {}
            };
        });

        // Story DM Reply Event
        const replyInput = document.getElementById('sv-reply-input');
        const replySendBtn = document.getElementById('sv-reply-send-btn');
        if (replySendBtn && replyInput) {
            const sendReply = async () => {
                const text = replyInput.value.trim();
                if (!text) return;
                replySendBtn.disabled = true;

                try {
                    const res = await fetch(`${API_BASE}/users/stories/${s._id}/reply`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ text })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        replyInput.value = '';
                        if (typeof showToast === 'function') showToast(`Reply sent to @${author.username}! 💬`);
                    } else {
                        alert(data.error || 'Failed to send reply');
                    }
                } catch (e) {
                    alert('Error sending story reply.');
                } finally {
                    replySendBtn.disabled = false;
                }
            };

            replySendBtn.onclick = sendReply;
            replyInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendReply();
                }
            };
        }
        
        const tapLeft = document.getElementById('sv-tap-left');
        const tapRight = document.getElementById('sv-tap-right');
        if (tapLeft) {
            tapLeft.onclick = (e) => {
                e.stopPropagation();
                clearTimeout(storyTimer);
                if (currentIndex > 0) {
                    currentIndex--;
                    renderViewer();
                }
            };
        }
        if (tapRight) {
            tapRight.onclick = (e) => {
                e.stopPropagation();
                clearTimeout(storyTimer);
                if (currentIndex < stories.length - 1) {
                    currentIndex++;
                    renderViewer();
                } else {
                    modal.remove();
                }
            };
        }

        // Tap & Hold to Pause Story (Instagram Feature)
        const storyCard = modal.querySelector('div');
        if (storyCard) {
            storyCard.onmousedown = () => clearTimeout(storyTimer);
            storyCard.onmouseup = () => {
                clearTimeout(storyTimer);
                storyTimer = setTimeout(() => {
                    if (currentIndex < stories.length - 1) {
                        currentIndex++;
                        renderViewer();
                    } else {
                        modal.remove();
                    }
                }, 3000);
            };
            storyCard.ontouchstart = () => clearTimeout(storyTimer);
            storyCard.ontouchend = () => {
                clearTimeout(storyTimer);
                storyTimer = setTimeout(() => {
                    if (currentIndex < stories.length - 1) {
                        currentIndex++;
                        renderViewer();
                    } else {
                        modal.remove();
                    }
                }, 3000);
            };
        }

        const deleteBtn = document.getElementById('sv-delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm('Delete this story?')) {
                    clearTimeout(storyTimer);
                    try {
                        const res = await fetch(`${API_BASE}/users/stories/${s._id}`, {
                            method: 'DELETE',
                            headers: getHeaders()
                        });
                        if (res.ok) {
                            if (typeof showToast === 'function') showToast('Story deleted.');
                            stories.splice(currentIndex, 1);
                            if (stories.length > 0) {
                                if (currentIndex >= stories.length) currentIndex = stories.length - 1;
                                renderViewer();
                            } else {
                                modal.remove();
                            }
                        }
                    } catch (e) {
                        alert('Failed to delete story.');
                    }
                }
            };
        }
    };

    document.body.appendChild(modal);
    renderViewer();
};

window.loadHomeStoriesTray = async function() {
    const container = document.getElementById('stories-container');
    if (!container) return;

    try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const myId = String(currentUser._id || currentUser.id || '');
        const myAvatar = currentUser.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${currentUser.username || 'me'}`;

        const res = await fetch(`${API_BASE}/users/stories`, { headers: getHeaders() });
        let storiesList = [];
        if (res.ok) {
            storiesList = await res.json();
        }

        const storyGroupMap = new Map();
        (storiesList || []).forEach(s => {
            const author = s.author;
            if (!author) return;
            const authorId = String(author._id || author.id || author);
            if (!storyGroupMap.has(authorId)) {
                storyGroupMap.set(authorId, { author, stories: [] });
            }
            storyGroupMap.get(authorId).stories.push(s);
        });

        const myGroup = storyGroupMap.get(myId);
        const myStories = myGroup ? myGroup.stories : [];

        let html = `
            <div class="story-item" onclick="openAddStoryModal()" title="Add to your story" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 72px;">
                <div style="position: relative; width: 62px; height: 62px; border-radius: 50%; border: 2.5px solid ${myStories.length > 0 ? 'var(--accent-gold)' : 'var(--border-color)'}; padding: 2px;">
                    <img src="${myAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    <div style="position: absolute; bottom: 0; right: 0; background: var(--spotlite-gradient); color: #000; width: 22px; height: 22px; border-radius: 50%; font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; border: 2px solid #000; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">+</div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-primary); font-weight: 600; text-align: center;">Your Story</span>
            </div>
        `;

        storyGroupMap.forEach((group, authorId) => {
            if (authorId === myId) return;
            const u = group.author;
            const uAvatar = u.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${u.username}`;
            const username = u.username || 'user';

            html += `
                <div class="story-item" onclick="openStoryGroupViewer('${authorId}')" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 72px;">
                    <div style="width: 62px; height: 62px; border-radius: 50%; border: 3px solid var(--accent-gold); padding: 2px; box-shadow: 0 0 12px rgba(255,203,5,0.6); transition: transform 0.2s;">
                        <img src="${uAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-primary); font-weight: 600; text-align: center; max-width: 68px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">@${escapeHtml(username)}</span>
                </div>
            `;
        });

        container.style.cssText = 'display: flex; gap: 16px; overflow-x: auto; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; margin-bottom: 20px; scrollbar-width: none;';
        container.innerHTML = html;

        window._homeStoryGroups = storyGroupMap;
    } catch (e) {
        console.error('Error loading stories tray:', e);
    }
};

window.openStoryGroupViewer = function(authorId) {
    if (window._homeStoryGroups && window._homeStoryGroups.has(String(authorId))) {
        const group = window._homeStoryGroups.get(String(authorId));
        if (group && group.stories && group.stories.length > 0) {
            openStoryViewerModal(group.stories);
            return;
        }
    }
    if (authorId) {
        fetch(`${API_BASE}/users/${authorId}/stories`, { headers: getHeaders() })
            .then(res => res.json())
            .then(stories => {
                if (Array.isArray(stories) && stories.length > 0) {
                    openStoryViewerModal(stories);
                } else if (typeof showToast === 'function') {
                    showToast('No active stories for this user.');
                }
            })
            .catch(e => console.error('Fetch stories error:', e));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.setupGlobalNavigationListeners();
    ensureCallModalsExist();
    bindCallModalButtons();
    setupGroupChatModal();
    if (document.getElementById('stories-container')) {
        loadHomeStoriesTray();
    }

    const inboxSearchInput = document.getElementById('inbox-search-input');
    if (inboxSearchInput) {
        inboxSearchInput.addEventListener('input', () => {
            const query = inboxSearchInput.value.trim().toLowerCase();
            const convItems = document.querySelectorAll('#conversations-inbox-list .conversation-item, #conversations-inbox-list .inbox-item, #conversations-inbox-list > div');
            convItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'flex' : 'none';
            });
        });
    }

    const startAudioBtn = document.getElementById('start-audio-call-btn');
    const startVideoBtn = document.getElementById('start-video-call-btn');
    if (startAudioBtn) startAudioBtn.addEventListener('click', () => {
        window._lastCallType = 'audio';
        startWebRTCCall(true);
    });
    if (startVideoBtn) startVideoBtn.addEventListener('click', () => {
        window._lastCallType = 'video';
        startWebRTCCall(false);
    });

    setTimeout(() => {
        initWebRTCEvents();
    }, 500);
});




