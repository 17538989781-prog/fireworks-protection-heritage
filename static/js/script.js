// 全局变量
let allHeritageData = [];
let currentFilter = "all";
let currentSearch = "";
const FALLBACK_IMAGE = "https://via.placeholder.com/600x400/8b0000/ffffff?text=%E5%9B%BE%E7%89%87%E5%8A%A0%E8%BD%BD%E4%B8%AD";

function resolveImageUrl(imageUrl) {
    if (!imageUrl) return FALLBACK_IMAGE;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    return imageUrl.startsWith('./') ? imageUrl : `./${imageUrl}`;
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
        const response = await fetch('./heritage-data.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        allHeritageData = await response.json();

        // 加载城市列表
        loadCities();

        // 渲染遗址卡片
        renderHeritageCards(allHeritageData);

        // 更新结果计数
        updateResultCount(allHeritageData.length);
    } catch (error) {
        console.error('加载数据失败:', error);
        document.getElementById('heritage-container').innerHTML =
            '<div class="error-message"><p>数据加载失败，请刷新页面重试。</p></div>';
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
                <img src="${resolveImageUrl(item.image)}" alt="${item.name}" class="card-img" loading="lazy" decoding="async" referrerpolicy="no-referrer">
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

    container.querySelectorAll('.card-img').forEach(img => {
        img.addEventListener('error', function() {
            this.src = FALLBACK_IMAGE;
        });
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
        modal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 按ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
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
    img.src = resolveImageUrl(heritage.image);
    img.alt = heritage.name;
    img.loading = 'eager';
    img.decoding = 'async';
    img.onerror = function() {
        img.src = FALLBACK_IMAGE;
    };
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