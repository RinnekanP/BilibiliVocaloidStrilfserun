document.addEventListener('DOMContentLoaded', function() {
    let datesData = {};
    let allVideos = {};
    let currentFilter = 'all';
    let currentSort = 'date-desc';
    let currentSearch = '';
    let searchTimeout;
    
    const datesContainer = document.getElementById('dates-container');
    const loadingElement = document.getElementById('loading');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterButtons = document.querySelectorAll('.filter-btn[data-type]');
    const sortButtons = document.querySelectorAll('.filter-btn[data-sort]');
    const modal = document.getElementById('video-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const bilibiliLink = document.getElementById('bilibili-link');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    const totalDaysEl = document.getElementById('total-days');
    const totalOriginalEl = document.getElementById('total-original');
    const totalCoverEl = document.getElementById('total-cover');
    const lastUpdatedEl = document.getElementById('last-updated');
    
    init();
    
    function init() {
        loadDatesData();
        setupEventListeners();
        showSkeleton();
    }
    
    function setupEventListeners() {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            currentSearch = e.target.value.toLowerCase();
            
            searchTimeout = setTimeout(() => {
                renderDates();
            }, 300);
        });
        
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            currentSearch = '';
            renderDates();
        });
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.type;
                renderDates();
            });
        });
        
        sortButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                sortButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentSort = this.dataset.sort;
                renderDates();
            });
        });
        
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                modal.classList.remove('show');
            });
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                modal.classList.remove('show');
            }
        });
    }
    
async function loadDatesData() {
    try {
        const response = await fetch('data/dates.json');
        
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.dates) {
            throw new Error('数据格式错误：缺少 dates 字段');
        }
        
        datesData = data.dates || {};
        
        updateStats(data);
        
        prefetchImportantData();
        
        renderSkeletonDates();
        
        await loadAllVideos();
        
        renderDates();
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showError(`无法加载数据: ${error.message}`);
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}
    
    async function loadAllVideos() {
        allVideos = {};
        
        const loadPromises = Object.entries(datesData).map(async ([dateDisplay, dateInfo]) => {
            try {
                const cacheKey = `video_data_${dateInfo.date}`;
                const cached = sessionStorage.getItem(cacheKey);
                
                if (cached) {
                    const videos = JSON.parse(cached);
                    videos.forEach(video => {
                        video.date = dateDisplay;
                        video.dateKey = dateInfo.date;
                    });
                    allVideos[dateDisplay] = videos;
                    return;
                }
                
                const response = await fetch(dateInfo.path, {
                    headers: {
                        'Cache-Control': 'max-age=3600'
                    }
                });
                
                if (!response.ok) return;
                
                const videos = await response.json();
                
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(videos));
                } catch (e) {}
                
                videos.forEach(video => {
                    video.date = dateDisplay;
                    video.dateKey = dateInfo.date;
                });
                
                videos.sort((a, b) => {
                    return parseDateTime(a.发布时间) - parseDateTime(b.发布时间);
                });
                
                allVideos[dateDisplay] = videos;
                
            } catch (error) {
                console.warn(`加载 ${dateInfo.filename} 异常:`, error);
            }
        });
        
        await Promise.allSettled(loadPromises);
    }
    
    function updateStats(data) {
        totalDaysEl.textContent = data.total_days || Object.keys(datesData).length;
        totalOriginalEl.textContent = data.total_original || 0;
        totalCoverEl.textContent = data.total_cover || 0;
        lastUpdatedEl.textContent = formatDateTime(data.last_updated);
    }
    
    function prefetchImportantData() {
        const recentDates = Object.entries(datesData)
            .sort((a, b) => b[1].sort_key.localeCompare(a[1].sort_key))
            .slice(0, 7);
        
        recentDates.forEach(([dateDisplay, dateInfo]) => {
            const cacheKey = `video_data_${dateInfo.date}`;
            if (!sessionStorage.getItem(cacheKey)) {
                fetch(dateInfo.path)
                    .then(response => response.json())
                    .then(videos => {
                        sessionStorage.setItem(cacheKey, JSON.stringify(videos));
                    })
                    .catch(() => {});
            }
        });
    }
    
    function renderSkeletonDates() {
        const dates = Object.entries(datesData);
        
        const skeletonHTML = dates.map(([dateDisplay, dateInfo]) => `
            <div class="date-card skeleton-card">
                <div class="date-header">
                    <div class="date-title">
                        <div class="skeleton skeleton-text" style="width: 200px; height: 24px;"></div>
                    </div>
                    <div class="date-stats">
                        <div class="skeleton skeleton-text" style="width: 80px; height: 20px;"></div>
                        <div class="skeleton skeleton-text" style="width: 60px; height: 20px;"></div>
                    </div>
                </div>
            </div>
        `).join('');
        
        datesContainer.innerHTML = skeletonHTML;
        loadingElement.style.display = 'none';
    }
    
    function renderDates() {
        if (Object.keys(datesData).length === 0) {
            datesContainer.innerHTML = '<div class="no-data">暂无数据</div>';
            loadingElement.style.display = 'none';
            return;
        }
        
        let dates = Object.entries(datesData);
        
        if (dates.length === 0) {
            datesContainer.innerHTML = '<div class="no-data">暂无数据</div>';
            loadingElement.style.display = 'none';
            return;
        }
        
        dates.sort((a, b) => {
            const dateA = a[1]?.sort_key || '';
            const dateB = b[1]?.sort_key || '';
            
            const infoA = a[1] || {};
            const infoB = b[1] || {};
            
            switch (currentSort) {
                case 'date-asc':
                    return dateA.localeCompare(dateB);
                case 'count-desc':
                    const countA = infoA.total_videos || 0;
                    const countB = infoB.total_videos || 0;
                    return countB - countA;
                case 'date-desc':
                default:
                    return dateB.localeCompare(dateA);
            }
        });
        
        dates = dates.filter(([dateDisplay, dateInfo]) => {
            if (!currentSearch && currentFilter === 'all') {
                return true;
            }
            
            return hasMatchingVideos(dateDisplay);
        });
        
        if (dates.length === 0) {
            datesContainer.innerHTML = '<div class="no-data">没有找到符合条件的视频</div>';
            loadingElement.style.display = 'none';
            return;
        }
        
        const datesHTML = dates.map(([dateDisplay, dateInfo]) => 
            createDateCard(dateDisplay, dateInfo)
        ).join('');
        
        datesContainer.innerHTML = datesHTML;
        loadingElement.style.display = 'none';
        
        bindDateCardEvents();
    }
    
    function hasMatchingVideos(dateDisplay) {
        const videos = allVideos[dateDisplay];
        if (!videos) return false;
        
        let filteredVideos = videos;
        if (currentFilter !== 'all') {
            filteredVideos = videos.filter(video => 
                video.分类 === currentFilter
            );
        }
        
        if (currentSearch) {
            filteredVideos = filteredVideos.filter(video => 
                matchesSearch(video, currentSearch)
            );
        }
        
        return filteredVideos.length > 0;
    }
    
    function matchesSearch(video, searchTerm) {
        if (!searchTerm.trim()) return true;
        
        if (video.标题 && video.标题.toLowerCase().includes(searchTerm)) return true;
        if (video.作者 && video.作者.toLowerCase().includes(searchTerm)) return true;
        if (video.标签 && video.标签.toLowerCase().includes(searchTerm)) return true;
        if (video.分类 && video.分类.toLowerCase().includes(searchTerm)) return true;
        
        if (video.简介 && video.简介.toLowerCase().includes(searchTerm)) return true;
        if (video.动态文案 && video.动态文案.toLowerCase().includes(searchTerm)) return true;
        
        return false;
    }
    
    function createDateCard(dateDisplay, dateInfo) {
        const videos = allVideos[dateDisplay];
        if (!videos) return '';
        
        let filteredVideos = videos;
        if (currentFilter !== 'all') {
            filteredVideos = videos.filter(video => 
                video.分类 === currentFilter
            );
        }
        if (currentSearch) {
            filteredVideos = filteredVideos.filter(video => 
                matchesSearch(video, currentSearch)
            );
        }
        
        const originalCount = filteredVideos.filter(v => v.分类 === 'Original').length;
        const coverCount = filteredVideos.filter(v => v.分类 === 'Cover').length;
        
        const videosHTML = filteredVideos.map(video => createVideoItem(video)).join('');
        
        return `
            <div class="date-card">
                <div class="date-header">
                    <div class="date-title">
                        <i class="fas fa-calendar-alt"></i>
                        ${dateDisplay}
                    </div>
                    <div class="date-stats">
                        <div class="date-stat">
                            <i class="fas fa-video"></i>
                            <span>${filteredVideos.length} 个视频</span>
                        </div>
                        <div class="date-stat">
                            <i class="fas fa-music"></i>
                            <span>O:${originalCount} C:${coverCount}</span>
                        </div>
                    </div>
                </div>
                <div class="date-content">
                    <div class="video-list">
                        ${videosHTML || '<p class="no-videos">没有符合条件的视频</p>'}
                    </div>
                </div>
            </div>
        `;
    }
    
    function createVideoItem(video) {
        const title = video.标题 || '未知标题';
        const bvid = video.BV号 || '';
        const author = video.作者 || '未知作者';
        const category = video.分类 || 'Other';
        const publishTime = video.发布时间 || '';
        const viewCount = video.播放量 || 0;
        const likeCount = video.点赞数 || 0;
        
        const displayTime = publishTime ? 
            publishTime.substring(11, 16) : '';
        
        const formatNumber = (num) => {
            if (num >= 10000) return (num / 10000).toFixed(1) + '万';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num.toString();
        };
        
        const categoryClass = category.toLowerCase();
        const categoryIcons = {
            'original': 'fa-star',
            'cover': 'fa-microphone-alt',
            'other': 'fa-question-circle'
        };
        const categoryIcon = categoryIcons[categoryClass] || 'fa-question-circle';
        
        const shortTitle = title.length > 80 ? 
            title.substring(0, 80) + '...' : title;
        
        return `
            <div class="video-item" data-bvid="${bvid}">
                <div class="video-header">
                    <div class="video-title" title="${escapeHtml(title)}">
                        ${escapeHtml(shortTitle)}
                    </div>
                    <div class="video-category category-${categoryClass}">
                        <i class="fas ${categoryIcon}"></i>
                        ${category}
                    </div>
                </div>
                <div class="video-meta">
                    <div class="video-author" title="${escapeHtml(author)}">
                        <i class="fas fa-user"></i>
                        <span>${escapeHtml(author.length > 20 ? author.substring(0, 20) + '...' : author)}</span>
                    </div>
                    <div class="video-time" title="${escapeHtml(publishTime)}">
                        <i class="fas fa-clock"></i>
                        <span>${displayTime}</span>
                    </div>
                </div>
                <div class="video-stats">
                    <div class="video-stat">
                        <i class="fas fa-play-circle"></i>
                        <span>${formatNumber(viewCount)}</span>
                    </div>
                    <div class="video-stat">
                        <i class="fas fa-heart"></i>
                        <span>${formatNumber(likeCount)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    function bindDateCardEvents() {
        const dateHeaders = document.querySelectorAll('.date-header');
        dateHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const card = this.parentElement;
                card.classList.toggle('expanded');
                
                const icon = this.querySelector('.date-title i');
                if (card.classList.contains('expanded')) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            });
        });
        
        const videoItems = document.querySelectorAll('.video-item');
        videoItems.forEach(item => {
            item.addEventListener('click', function() {
                const bvid = this.dataset.bvid;
                const video = findVideoByBvid(bvid);
                if (video) {
                    showVideoDetails(video);
                }
            });
        });
    }
    
    function findVideoByBvid(bvid) {
        for (const date in allVideos) {
            const video = allVideos[date].find(v => v.BV号 === bvid);
            if (video) return video;
        }
        return null;
    }
    
    function showVideoDetails(video) {
        modalTitle.textContent = escapeHtml(video.标题 || '未知标题');
        
        if (video.BV号) {
            bilibiliLink.href = `https://www.bilibili.com/video/${video.BV号}`;
            bilibiliLink.style.display = 'inline-flex';
        } else {
            bilibiliLink.style.display = 'none';
        }
        
        modalBody.innerHTML = createVideoDetailsHTML(video);
        
        modal.classList.add('show');
    }
    
    function createVideoDetailsHTML(video) {
        const idSection = `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-id-card"></i>
                    视频ID信息
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">BV号</div>
                        <div class="detail-value">${escapeHtml(video.BV号 || '未知')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">AV号</div>
                        <div class="detail-value">${escapeHtml(video.AV号 || '未知')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">AID</div>
                        <div class="detail-value">${escapeHtml(video.aid || '未知')}</div>
                    </div>
                </div>
            </div>
        `;
        
        const basicInfo = [
            { label: '发布时间', value: video.发布时间, icon: 'calendar' },
            { label: '作者', value: video.作者, icon: 'user' },
            { label: '分类', value: video.分类, icon: 'tag' },
            { label: '原创性', value: video.原创性, icon: 'certificate' },
            { label: '时长', value: video.时长, icon: 'clock' }
        ];
        
        const basicInfoHTML = basicInfo
            .filter(item => item.value)
            .map(item => `
                <div class="detail-item">
                    <div class="detail-label">
                        <i class="fas fa-${item.icon}"></i>
                        ${item.label}
                    </div>
                    <div class="detail-value">${escapeHtml(item.value)}</div>
                </div>
            `).join('');
        
        const stats = [
            { label: '播放量', value: video.播放量, icon: 'play-circle' },
            { label: '点赞数', value: video.点赞数, icon: 'heart' },
            { label: '投币数', value: video.投币数, icon: 'coins' },
            { label: '收藏数', value: video.收藏数, icon: 'bookmark' },
            { label: '分享数', value: video.分享数, icon: 'share-alt' },
            { label: '弹幕数', value: video.弹幕数, icon: 'comment' },
            { label: '评论数', value: video.评论数, icon: 'comments' }
        ];
        
        const statsHTML = stats
            .filter(item => item.value !== undefined)
            .map(item => `
                <div class="detail-item">
                    <div class="detail-label">
                        <i class="fas fa-${item.icon}"></i>
                        ${item.label}
                    </div>
                    <div class="detail-value">${formatNumber(item.value)}</div>
                </div>
            `).join('');
        
        let tagsHTML = '';
        if (video.标签) {
            const tags = video.标签.split(',').filter(tag => tag.trim());
            if (tags.length > 0) {
                tagsHTML = `
                    <div class="detail-section">
                        <div class="detail-section-title">
                            <i class="fas fa-tags"></i>
                            标签 (${video.标签数量 || tags.length})
                        </div>
                        <div class="tags-container">
                            ${tags.map(tag => `
                                <span class="tag">${escapeHtml(tag.trim())}</span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        let descriptionHTML = '';
        if (video.简介) {
            descriptionHTML = `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fas fa-align-left"></i>
                        简介
                    </div>
                    <div class="detail-value">${escapeHtml(video.简介)}</div>
                </div>
            `;
        }
        
        let dynamicHTML = '';
        if (video.动态文案) {
            dynamicHTML = `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fas fa-comment-dots"></i>
                        动态文案
                    </div>
                    <div class="detail-value">${escapeHtml(video.动态文案)}</div>
                </div>
            `;
        }
        
        return `
            ${idSection}
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-info-circle"></i>
                    基本信息
                </div>
                ${basicInfoHTML}
            </div>
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-chart-bar"></i>
                    统计数据
                </div>
                ${statsHTML}
            </div>
            ${tagsHTML}
            ${descriptionHTML}
            ${dynamicHTML}
        `;
    }
    
    function showSkeleton() {
        const container = document.getElementById('dates-container');
        const skeletonHTML = `
            <div class="skeleton-card">
                <div class="skeleton skeleton-text" style="width: 60%; height: 24px; margin-bottom: 15px;"></div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div class="skeleton skeleton-text" style="width: 100px; height: 20px;"></div>
                    <div class="skeleton skeleton-text" style="width: 80px; height: 20px;"></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                    ${Array(6).fill(0).map(() => `
                        <div class="skeleton" style="height: 120px; border-radius: 8px;"></div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = skeletonHTML.repeat(3);
    }
    
    function showError(message) {
        datesContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-sync-alt"></i> 重新加载
                </button>
            </div>
        `;
        loadingElement.style.display = 'none';
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatNumber(num) {
        if (!num && num !== 0) return 'N/A';
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        if (num >= 1000) return (num / 1000).toFixed(1) + '千';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    function parseDateTime(datetimeStr) {
        if (!datetimeStr) return 0;
        
        const match = datetimeStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            const hour = parseInt(match[4]);
            const minute = parseInt(match[5]);
            const second = match[6] ? parseInt(match[6]) : 0;
            
            return new Date(year, month, day, hour, minute, second).getTime();
        }
        
        return 0;
    }
    
    function formatDateTime(datetimeStr) {
        if (!datetimeStr) return '-';
        try {
            const date = new Date(datetimeStr);
            return date.toLocaleDateString('zh-CN') + ' ' + 
                   date.toLocaleTimeString('zh-CN', { 
                       hour: '2-digit', 
                       minute: '2-digit' 
                   });
        } catch (e) {
            return datetimeStr;
        }
    }
});