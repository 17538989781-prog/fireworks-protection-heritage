// 全局变量
let allHeritageData = [];
let currentFilter = "all";
let currentSearch = "";
let modalCarouselTimer = null;
const LOCAL_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_CITY_ALBUM_IMAGES = 12;

function resolveImageUrl(imageUrl) {
    if (!imageUrl) return "";
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    return imageUrl.startsWith('./') ? imageUrl : `./${imageUrl}`;
}

function getImageCandidates(item) {
    const candidates = [];
    const city = item?.city || "河南";

    // 首屏只尝试少量候选，减少请求数量
    LOCAL_IMAGE_EXTENSIONS.forEach(ext => {
        candidates.push(`./static/temp_images/${city}.${ext}`);
        candidates.push(`./static/temp_images/${city}_1.${ext}`);
    });

    // 兼容另一套目录命名
    LOCAL_IMAGE_EXTENSIONS.forEach(ext => {
        candidates.push(`./static/city-images/${city}.${ext}`);
        candidates.push(`./static/city-images/${city}_1.${ext}`);
    });

    // 兼容数据中的图片字段
    if (item?.image) {
        const resolved = resolveImageUrl(item.image);
        if (resolved) candidates.push(resolved);
    }

    return candidates;
}

function attachProgressiveImageFallback(imgElement, item) {
    const candidates = getImageCandidates(item);
    let index = 0;

    const tryNext = () => {
        if (index >= candidates.length) {
            imgElement.src = "";
            imgElement.style.display = "none";
            return;
        }
        imgElement.style.display = "";
        imgElement.src = candidates[index];
        index += 1;
    };

    imgElement.onerror = function() {
        tryNext();
    };

    tryNext();
}

function stopModalCarousel() {
    if (modalCarouselTimer) {
        clearInterval(modalCarouselTimer);
        modalCarouselTimer = null;
    }
}

function getCityAlbumCandidates(item) {
    const city = item?.city || "河南";
    const candidates = [];
    for (let i = 1; i <= MAX_CITY_ALBUM_IMAGES; i += 1) {
        LOCAL_IMAGE_EXTENSIONS.forEach(ext => {
            candidates.push(`./static/temp_images/${city}_${i}.${ext}`);
        });
    }
    return candidates;
}

function loadImageOnce(url, timeoutMs = 800) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        img.onload = () => {
            clearTimeout(timer);
            resolve(url);
        };
        img.onerror = () => {
            clearTimeout(timer);
            reject(new Error("error"));
        };
        img.src = url;
    });
}

async function collectAvailableImages(candidates, limit = 6) {
    const available = [];
    for (const url of candidates) {
        if (available.length >= limit) break;
        try {
            const loaded = await loadImageOnce(url);
            available.push(loaded);
        } catch (err) {
            // ignore and continue probing next candidate
        }
    }
    return available;
}

async function setupModalCarousel(imgElement, item) {
    stopModalCarousel();
    const city = item?.city || "河南";
    
    // 先秒出首图，避免打开弹窗时卡顿
    attachProgressiveImageFallback(imgElement, item);

    // 后台收集轮播图，不阻塞首图显示
    const coverCandidates = LOCAL_IMAGE_EXTENSIONS.map(ext => `./static/temp_images/${city}.${ext}`);
    const cover = await collectAvailableImages(coverCandidates, 1);
    const albumCandidates = getCityAlbumCandidates(item);
    const album = await collectAvailableImages(albumCandidates, 6);
    const images = [...cover, ...album.filter(url => !cover.includes(url))];

    if (images.length > 1) {
        let idx = 0;
        imgElement.src = images[idx];
        modalCarouselTimer = setInterval(() => {
            idx = (idx + 1) % images.length;
            imgElement.src = images[idx];
        }, 3000);
    }
}

function applyHeritageData(data) {
    allHeritageData = Array.isArray(data) ? data : [];
    loadCities();
    renderHeritageCards(allHeritageData);
    updateResultCount(allHeritageData.length);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 加载遗址数据
    loadHeritageData();

    // 设置城市筛选功能
    setupCityFilter();

    // 设置搜索功能
    setupSearch();

    // 设置模态框功能
    setupModal();
});

// 加载遗址数据
async function loadHeritageData() {
    try {
        // 兼容直接双击 index.html（file://）场景：优先使用内置 JS 数据
        if (window.location.protocol === 'file:') {
            if (!window.HERITAGE_DATA) {
                await loadScript('./heritage-data.js');
            }
            if (window.HERITAGE_DATA) {
                applyHeritageData(window.HERITAGE_DATA);
                return;
            }
            throw new Error('file 模式下未找到 heritage-data.js');
        }

        const response = await fetch('./heritage-data.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        applyHeritageData(data);
    } catch (error) {
        console.error('加载数据失败:', error);
        document.getElementById('heritage-container').innerHTML =
            '<div class="error-message"><p>数据加载失败。若你是直接双击打开页面，请确认项目根目录存在 heritage-data.js。</p></div>';
    }
}

// 加载城市列表
function loadCities() {
    const cityButtonsContainer = document.getElementById('city-buttons');
    const cities = [...new Set(allHeritageData.map(item => item.city))].sort();

    // 清空现有按钮（除了"全部城市"）
    const allCityBtn = cityButtonsContainer.querySelector('[data-city="all"]');
    cityButtonsContainer.innerHTML = '';
    cityButtonsContainer.appendChild(allCityBtn);

    // 添加城市按钮
    cities.forEach(city => {
        const button = document.createElement('button');
        button.className = 'city-btn';
        button.setAttribute('data-city', city);
        button.innerHTML = `<i class="fas fa-city"></i> ${city}`;

        button.addEventListener('click', function() {
            // 更新按钮状态
            document.querySelectorAll('.city-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // 更新当前筛选
            currentFilter = city;

            // 筛选并渲染遗址卡片
            filterAndRenderHeritage();
        });

        cityButtonsContainer.appendChild(button);
    });
}

// 筛选并渲染遗址卡片
function filterAndRenderHeritage() {
    let filteredData = allHeritageData;

    // 应用城市筛选
    if (currentFilter !== "all") {
        filteredData = filteredData.filter(item => item.city === currentFilter);
    }

    // 应用搜索筛选
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filteredData = filteredData.filter(item =>
            item.name.toLowerCase().includes(searchLower) ||
            item.location.toLowerCase().includes(searchLower) ||
            item.basicInfo.toLowerCase().includes(searchLower) ||
            item.history.toLowerCase().includes(searchLower) ||
            item.features.toLowerCase().includes(searchLower)
        );
    }

    // 渲染遗址卡片
    renderHeritageCards(filteredData);

    // 更新结果计数
    updateResultCount(filteredData.length);
}

// 渲染遗址卡片
function renderHeritageCards(data) {
    const container = document.getElementById('heritage-container');

    if (data.length === 0) {
        container.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3 style="color: #666; margin-bottom: 1rem;">未找到相关遗址</h3>
                <p style="color: #888;">尝试调整筛选条件或搜索关键词</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'heritage-card';
        card.setAttribute('data-id', item.id);

        card.innerHTML = `
            <div class="card-img-container">
                <img alt="${item.name}" data-city="${item.city}" class="card-img" loading="lazy" decoding="async" referrerpolicy="no-referrer">
            </div>
            <div class="card-content">
                <h3 class="card-title"><i class="fas fa-landmark"></i> ${item.name}</h3>
                <p class="card-location"><i class="fas fa-map-marker-alt"></i> ${item.location}</p>
                <p class="card-desc">${item.basicInfo}</p>
                <div class="card-footer">
                    <span class="card-city"><i class="fas fa-city"></i> ${item.city}</span>
                    <a href="#" class="view-btn">查看详情 <i class="fas fa-arrow-right"></i></a>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.heritage-card').forEach(card => {
        const id = parseInt(card.getAttribute('data-id'));
        const item = allHeritageData.find(row => row.id === id);
        const img = card.querySelector('.card-img');
        if (img && item) {
            attachProgressiveImageFallback(img, item);
        }
    });
}

// 设置城市筛选功能
function setupCityFilter() {
    const cityButtons = document.querySelectorAll('.city-btn');

    cityButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 更新按钮状态
            cityButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // 更新当前筛选
            currentFilter = this.getAttribute('data-city');

            // 筛选并渲染遗址卡片
            filterAndRenderHeritage();
        });
    });
}

// 设置搜索功能
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    // 搜索按钮点击事件
    searchBtn.addEventListener('click', function() {
        currentSearch = searchInput.value.trim();
        filterAndRenderHeritage();
    });

    // 输入框回车事件
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentSearch = searchInput.value.trim();
            filterAndRenderHeritage();
        }
    });

    // 输入框变化事件（实时搜索）
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = searchInput.value.trim();
            filterAndRenderHeritage();
        }, 300); // 300ms防抖
    });
}

// 设置模态框功能
function setupModal() {
    const modal = document.getElementById('heritage-modal');
    const closeBtn = document.getElementById('close-modal');
    const container = document.getElementById('heritage-container');

    // 点击遗址卡片打开模态框
    container.addEventListener('click', function(e) {
        e.preventDefault();

        const card = e.target.closest('.heritage-card');
        if (card) {
            const id = parseInt(card.getAttribute('data-id'));
            const heritage = allHeritageData.find(item => item.id === id);

            if (heritage) {
                openModal(heritage);
            }
        }

        // 点击"查看详情"按钮
        if (e.target.classList.contains('view-btn') || e.target.closest('.view-btn')) {
            e.preventDefault();
            const card = e.target.closest('.heritage-card');
            if (card) {
                const id = parseInt(card.getAttribute('data-id'));
                const heritage = allHeritageData.find(item => item.id === id);

                if (heritage) {
                    openModal(heritage);
                }
            }
        }
    });

    // 点击关闭按钮关闭模态框
    closeBtn.addEventListener('click', function() {
        stopModalCarousel();
        modal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            stopModalCarousel();
            modal.style.display = 'none';
        }
    });

    // 按ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            stopModalCarousel();
            modal.style.display = 'none';
        }
    });
}

// 打开模态框并填充数据
function openModal(heritage) {
    const modal = document.getElementById('heritage-modal');
    const title = document.getElementById('modal-title');
    const img = document.getElementById('modal-img');
    const basicInfo = document.getElementById('modal-basic-info');
    const history = document.getElementById('modal-history');
    const features = document.getElementById('modal-features');
    const address = document.getElementById('modal-address');
    const specialtyContainer = document.getElementById('modal-specialty');

    // 填充数据
    title.textContent = heritage.name;
    img.alt = heritage.name;
    img.loading = 'eager';
    img.decoding = 'async';
    setupModalCarousel(img, heritage);
    basicInfo.textContent = heritage.basicInfo;
    history.textContent = heritage.history;
    features.textContent = heritage.features;
    address.textContent = heritage.address;

    // 填充特产
    specialtyContainer.innerHTML = '';
    heritage.specialties.forEach(specialty => {
        const item = document.createElement('div');
        item.className = 'specialty-item';
        item.innerHTML = `<i class="fas fa-star"></i> ${specialty}`;
        specialtyContainer.appendChild(item);
    });

    // 显示模态框
    modal.style.display = 'block';

    // 滚动到顶部
    modal.querySelector('.modal-body').scrollTop = 0;
}

// 更新结果计数
function updateResultCount(count) {
    const resultCount = document.getElementById('result-count');
    resultCount.textContent = `找到 ${count} 个遗址`;
}

// 添加一些动画效果
function addCardAnimation() {
    const cards = document.querySelectorAll('.heritage-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in');
    });
}

// 添加淡入动画
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        animation: fadeIn 0.5s ease-out forwards;
        opacity: 0;
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);