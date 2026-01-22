/**
 * 通用请求函数（适配所有接口，处理加载中状态）
 * @param {String} url - 请求地址
 * @param {String} method - 请求方法 GET/POST/PUT/DELETE
 * @param {Object} data - 请求参数
 * @returns {Promise} 返回接口数据
 */
async function request(url, method = 'GET', data = {}) {
    // 修复：使用类名选择加载元素（原生浏览器不支持:contains）
    const loadingElements = document.querySelectorAll('.loading-text');
    loadingElements.forEach(el => {
        el.style.color = "#999";
        el.innerHTML = "加载中...";
        el.style.display = 'block';
    });
    
    try {
        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            credentials: 'include' // 携带cookie，处理登录态
        };

        // GET请求拼参数，非GET请求传body
        let requestUrl = url;
        if (method.toUpperCase() === 'GET' && Object.keys(data).length > 0) {
            const params = new URLSearchParams(data);
            requestUrl = `${url}?${params.toString()}`;
        } else if (method.toUpperCase() !== 'GET') {
            fetchOptions.body = JSON.stringify(data);
        }

        const response = await fetch(requestUrl, fetchOptions);
        if (!response.ok) throw new Error(`HTTP错误：${response.status}`);
        
        const result = await response.json();

        // 请求成功处理（兼容字符串/数字200）
        if (result.code === "200" || result.code === 200) {
            loadingElements.forEach(el => el.style.display = 'none');
            return result.data;
        } 
        // 未登录处理（兼容字符串/数字401）
        else if (result.code === "401" || result.code === 401) {
            alert(result.msg || '请先登录');
            window.location.href = '/login.html';
        } 
        // 业务错误处理
        else {
            alert(result.msg || '操作失败');
            loadingElements.forEach(el => {
                el.innerHTML = "操作失败，请重试";
                el.style.color = "#f00";
            });
            return null;
        }
    } catch (error) {
        console.error("请求异常：", error);
        loadingElements.forEach(el => {
            el.innerHTML = "加载失败，请检查网络/后端";
            el.style.color = "#f00";
        });
        return null;
    }
}

// ====================== 全局变量：登录状态 ======================
let isLogin = false; // 是否登录
let currentUser = null; // 当前登录用户
const DEFAULT_AVATAR = 'images/default-avatar.png'; // 默认头像路径（需放置该图片）

// ====================== 登录状态相关 ======================
/**
 * 初始化登录状态（核心修改：不走全局request函数，避免401强制跳转）
 */
async function initLoginStatus() {
    try {
        // 手动发请求，单独处理结果，不触发全局401拦截
        const response = await fetch('http://localhost:8081/user/current', {
            method: 'GET',
            credentials: 'include', // 携带cookie
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            }
        });
        const result = await response.json();
        
        // 仅当接口返回成功时，才标记为登录状态
        if (result.code === 200 || result.code === "200") {
            isLogin = true;
            currentUser = result.data;
            // 补全默认头像（兼容avatar和avatarUrl字段）
            if (!currentUser.avatarUrl && currentUser.avatar) {
                currentUser.avatarUrl = currentUser.avatar;
            }
            if (!currentUser.avatarUrl) {
                currentUser.avatarUrl = DEFAULT_AVATAR;
            }
        } else {
            // 接口返回失败（含401），仅置空状态，不跳转
            isLogin = false;
            currentUser = null;
        }
    } catch (err) {
        // 请求失败（网络/接口不存在），仅置空状态，不跳转
        console.log('未检测到登录状态：', err);
        isLogin = false;
        currentUser = null;
    }
    // 更新页面登录信息展示
    updateLoginButton();
}

/**
 * 更新页面右上角登录信息展示（兼容loginBtn和loginContainer两种ID）
 */
function updateLoginButton() {
    // 兼容原有loginBtn，同时支持新的loginContainer
    const loginBtn = document.getElementById('loginBtn');
    const loginContainer = document.getElementById('loginContainer');
    const targetEl = loginContainer || loginBtn;
    
    if (!targetEl) return;
    
    if (isLogin && currentUser) {
        // 登录后展示：适配index.html的CSS类，解决文字看不见问题
        targetEl.innerHTML = `
            <div class="user-info">
                <img src="${currentUser.avatarUrl || DEFAULT_AVATAR}" alt="头像" class="user-avatar">
                <span>${currentUser.nickname || currentUser.username}</span>
                <button class="user-menu-btn" onclick="toggleUserMenu(event)">▼</button>
                <!-- 下拉菜单：使用页面定义的CSS类 -->
                <div id="userMenuDropdown" class="user-dropdown">
                    <a class="dropdown-item" onclick="logout()">退出登录</a>
                    <a class="dropdown-item" onclick="switchAccount()">切换账号</a>
                </div>
            </div>
        `;
    } else {
        // 未登录展示：登录/注册按钮
        targetEl.innerHTML = '<a href="login.html" class="login-link">登录/注册</a>';
    }
}

/**
 * 切换用户下拉菜单显示/隐藏（适配页面CSS类）
 */
function toggleUserMenu(e) {
    e.stopPropagation(); // 阻止事件冒泡
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        // 切换show类控制显示/隐藏，匹配页面CSS
        dropdown.classList.toggle('show');
        // 点击其他区域关闭菜单
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        }, { once: true }); // 只执行一次，避免重复绑定
    }
}

/**
 * 退出登录
 */
async function logout() {
    try {
        await request('http://localhost:8081/user/logout', 'POST');
    } catch (e) {
        console.log('退出登录接口未实现，模拟退出');
    }
    isLogin = false;
    currentUser = null;
    updateLoginButton();
    alert('退出成功！');
    window.location.href = 'index.html';
}

/**
 * 切换账号
 */
function switchAccount() {
    if (confirm('确定要切换账号吗？')) {
        logout();
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    }
}

// ====================== 用户相关接口 ======================
/**
 * 注册（支持头像上传+确认密码，单独处理表单数据）
 */
async function doRegisterWithAvatar(formData) {
    try {
        const response = await axios.post('http://localhost:8081/user/register', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            withCredentials: true
        });
        const result = response.data;
        if (result.code === 200 || result.code === "200") {
            return result.data;
        } else {
            alert(result.msg || '注册失败');
            return null;
        }
    } catch (err) {
        console.error('注册失败：', err);
        alert('注册失败：' + (err.response?.data?.msg || '网络错误'));
        return null;
    }
}

/**
 * 普通注册（兼容原有逻辑）
 */
async function doRegister(userData) {
    const { username, password, nickname, confirmPassword } = userData;
    if (!username) { alert('请输入用户名'); return; }
    if (!password) { alert('请输入密码'); return; }
    if (password !== confirmPassword) { alert('两次密码不一致'); return; }

    return await request('http://localhost:8081/user/register', 'POST', {
        username,
        password,
        nickname: nickname || '',
        confirmPassword
    });
}

/**
 * 登录（修复：确保返回true/false，解决跳转问题）
 */
async function doLogin(username, password) {
    if (!username) { alert('请输入用户名'); return false; }
    if (!password) { alert('请输入密码'); return false; }

    const result = await request('http://localhost:8081/user/login', 'POST', { username, password });
    if (result) {
        isLogin = true;
        currentUser = result;
        // 补全默认头像（兼容avatar和avatarUrl）
        if (!currentUser.avatarUrl && currentUser.avatar) {
            currentUser.avatarUrl = currentUser.avatar;
        }
        if (!currentUser.avatarUrl) {
            currentUser.avatarUrl = DEFAULT_AVATAR;
        }
        updateLoginButton();
        return true; // 返回true表示登录成功
    }
    return false; // 返回false表示登录失败
}

// ====================== 文化故事接口 ======================
async function getDailyRecommend(type = "story") {
    return await request(`http://localhost:8081/culture-story/daily/${type}`, 'GET');
}

async function getAllStories() {
    return await request('http://localhost:8081/culture-story', 'GET');
}

async function getStoryPage(pageNum = 1, pageSize = 10) {
    return await request(`http://localhost:8081/culture-story/page`, 'GET', { pageNum, pageSize });
}

// 核心修改：解决400错误的关键
async function addCultureStory(storyData) {
    // 字段映射：reason → recommendReason（匹配后端实体类）
    const submitData = {
        title: storyData.title,
        content: storyData.content,
        coverUrl: storyData.coverUrl,
        pushDate: storyData.pushDate,
        type: storyData.type,
        recommendReason: storyData.reason,
        location: ""
    };

    // 仅校验必填字段
    if (!submitData.title) { alert('请输入故事标题'); return null; }
    if (!submitData.content) { alert('请输入故事内容'); return null; }
    if (!submitData.pushDate) { alert('请选择发布日期'); return null; }
    
    return await request('http://localhost:8081/culture-story', 'POST', submitData);
}

async function updateCultureStory(id, storyData) {
    if (!id) { alert('缺少故事ID'); return null; }
    return await request(`http://localhost:8081/culture-story/${id}`, 'PUT', storyData);
}

async function deleteCultureStory(id) {
    if (!confirm('确定删除该故事吗？')) return null;
    return await request(`http://localhost:8081/culture-story/${id}`, 'DELETE');
}

// 新增：获取文化故事详情（修复openStoryEditModal调用错误）
async function getStoryById(id) {
    if (!id) { alert('缺少故事ID'); return null; }
    return await request(`http://localhost:8081/culture-story/${id}`, 'GET');
}

// ====================== 打卡接口（CheckIn） ======================
async function addCheckIn(checkInData) {
    if (!checkInData.userId) { alert('请输入用户ID'); return null; }
    if (!checkInData.checkInContent) { alert('请输入打卡内容'); return null; }
    return await request('http://localhost:8081/check-in', 'POST', checkInData);
}

async function getCheckInPage(pageNum = 1, pageSize = 10) {
    return await request(`http://localhost:8081/check-in/page`, 'GET', { pageNum, pageSize });
}

async function getAllCheckIns() {
    return await request('http://localhost:8081/check-in', 'GET');
}

async function getCheckInById(id) {
    if (!id) { alert('缺少打卡ID'); return null; }
    return await request(`http://localhost:8081/check-in/${id}`, 'GET');
}

async function updateCheckIn(id, checkInData) {
    if (!id) { alert('缺少打卡ID'); return null; }
    return await request(`http://localhost:8081/check-in/${id}`, 'PUT', checkInData);
}

async function deleteCheckIn(id) {
    if (!confirm('确定删除该打卡记录吗？')) return null;
    return await request(`http://localhost:8081/check-in/${id}`, 'DELETE');
}

// ====================== 藏品订单接口（核心修改：加登录校验） ======================
async function buyCollection(orderData) {
    // 手动校验登录，未登录不调用接口，避免触发401跳转
    if (!isLogin) {
        alert('请先登录后再购买藏品！');
        window.location.href = 'login.html';
        return null;
    }
    if (!orderData.collectionId) {
        alert('请选择要购买的藏品');
        return null;
    }
    return await request('http://localhost:8081/collection-order', 'POST', orderData);
}

async function getMyCollectionOrders() {
    // 手动校验登录
    if (!isLogin) {
        alert('请先登录查看我的订单！');
        window.location.href = 'login.html';
        return null;
    }
    return await request('http://localhost:8081/collection-order/my', 'GET');
}

// ====================== 文化藏品接口 ======================
async function addCultureCollection(collectionData) {
    // 空值校验
    if (!collectionData.name) { alert('请输入藏品名称'); return null; }
    if (!collectionData.creator) { alert('请输入创作者'); return null; }
    if (collectionData.price === undefined || isNaN(collectionData.price)) { alert('请输入有效价格'); return null; }
    if (collectionData.stock === undefined || isNaN(collectionData.stock)) { alert('请输入有效库存'); return null; }
    
    return await request('http://localhost:8081/culture-collection', 'POST', collectionData);
}

async function getCollectionPage(pageNum = 1, pageSize = 10) {
    return await request(`http://localhost:8081/culture-collection/page`, 'GET', { pageNum, pageSize });
}

async function getAllCollections() {
    return await request('http://localhost:8081/culture-collection', 'GET');
}

async function getCollectionById(id) {
    if (!id) { alert('缺少藏品ID'); return null; }
    return await request(`http://localhost:8081/culture-collection/${id}`, 'GET');
}

async function updateCultureCollection(id, collectionData) {
    if (!id) { alert('缺少藏品ID'); return null; }
    return await request(`http://localhost:8081/culture-collection/${id}`, 'PUT', collectionData);
}

async function deleteCultureCollection(id) {
    if (!confirm('确定删除该藏品吗？')) return null;
    return await request(`http://localhost:8081/culture-collection/${id}`, 'DELETE');
}

// ====================== 用户打卡足迹接口（核心修改：加登录校验） ======================
async function addUserFootprint(footData) {
    if (!isLogin) {
        alert('请先登录后再添加足迹！');
        window.location.href = 'login.html';
        return null;
    }
    if (!footData.location) {
        alert('请输入打卡地点');
        return null;
    }
    return await request('http://localhost:8081/user-check-in', 'POST', footData);
}

async function getMyFootprint() {
    if (!isLogin) {
        alert('请先登录查看个人足迹！');
        window.location.href = 'login.html';
        return null;
    }
    return await request('http://localhost:8081/user-check-in/my', 'GET');
}

async function deleteFootprint(id) {
    if (!isLogin) {
        alert('请先登录后再删除足迹！');
        window.location.href = 'login.html';
        return null;
    }
    if (!confirm('确定删除该足迹吗？')) return null;
    return await request(`http://localhost:8081/user-check-in/${id}`, 'DELETE');
}

// ====================== 个性化推荐接口（核心修改：加登录校验） ======================
async function getPersonalRecommend() {
    if (!isLogin) {
        // 未登录时返回空，不弹窗不跳转，页面显示“暂无个性化推荐”
        return null;
    }
    return await request('http://localhost:8081/culture-story/personal', 'GET');
}

// ====================== 通用初始化函数 ======================
async function initPage(pageType) {
    // 先初始化登录状态
    await initLoginStatus();

    switch (pageType) {
        case "index":
            await initIndexPage(); // 加await确保加载完成
            break;
        case "story":
            await initStoryPage();
            break;
        case "check-in":
            await initCheckInPage();
            break;
        case "collection":
            await initCollectionPage();
            break;
        case "footprint":
            await initFootprintPage();
            break;
    }
}

// ====================== 各页面专属初始化函数 ======================
// 首页初始化
async function initIndexPage() {
    const dailyRecommendEl = document.getElementById('dailyRecommend');
    if (dailyRecommendEl) {
        try {
            const recommend = await getDailyRecommend('story');
            dailyRecommendEl.innerHTML = `
                <div class="recommend-card">
                    <h3>${recommend?.title || '暂无推荐'}</h3>
                    <p>${recommend?.content?.substring(0, 200) || '暂无内容'}${recommend?.content?.length > 200 ? '...' : ''}</p>
                    <p class="reason"><strong>推荐理由：</strong>${recommend?.reason || '精选优质文化内容'}</p>
                </div>
            `;
        } catch (err) {
            dailyRecommendEl.innerHTML = '<p style="text-align:center; padding:20px;">暂无每日推荐</p>';
        }
    }

    if (isLogin) {
        document.getElementById('personalFootprintLink')?.style.setProperty('display', 'inline');
        document.getElementById('collectionMarketLink')?.style.setProperty('display', 'inline');
        document.getElementById('personalFootprintCard')?.style.setProperty('display', 'block');
        document.getElementById('collectionMarketCard')?.style.setProperty('display', 'block');

        const personalRecommendEl = document.getElementById('personalRecommend');
        const personalCardEl = document.getElementById('personalRecommendCard');
        if (personalRecommendEl && personalCardEl) {
            personalCardEl.style.display = 'block';
            try {
                const personal = await getPersonalRecommend();
                personalRecommendEl.innerHTML = `
                    <div class="recommend-card">
                        <h3>${personal?.title || '暂无个性化推荐'}</h3>
                        <p>${personal?.content?.substring(0, 200) || '暂无内容'}${personal?.content?.length > 200 ? '...' : ''}</p>
                        <p class="reason"><strong>推荐理由：</strong>${personal?.reason || '基于你的打卡足迹和收藏偏好推荐'}</p>
                    </div>
                `;
            } catch (err) {
                personalRecommendEl.innerHTML = '<p style="text-align:center; padding:10px;">暂无个性化推荐</p>';
            }
        }
    }
}

// 文化故事页初始化
async function initStoryPage() {
    const dailyEl = document.getElementById('dailyRecommend');
    if (dailyEl) {
        try {
            const recommend = await getDailyRecommend('story');
            if (recommend && recommend.id) {
                dailyEl.innerHTML = `
                    <h3 style="text-align:center; margin:10px 0;">每日推荐</h3>
                    <h4 style="padding:0 20px;">${recommend.title || '无标题'}</h4>
                    <p style="padding:0 20px; line-height:1.6;">${recommend.content?.substring(0, 200) || '暂无内容'}...</p>
                    ${recommend.coverUrl ? `<img src="${recommend.coverUrl}" style="width:100%; margin:10px 0; border-radius:4px;">` : ''}
                    <p style="padding:0 20px; color:#666;">推荐理由：${recommend.reason || '暂无'}</p>
                `;
            } else {
                dailyEl.innerHTML = '<p style="text-align:center; padding:20px;">暂无每日推荐</p>';
            }
        } catch (err) {
            dailyEl.innerHTML = '<p style="text-align:center; padding:20px; color:red;">加载失败</p>';
        }
    }

    const storyTable = document.getElementById('storyTable');
    if (storyTable) {
        // 添加loading-text类标识加载元素
        storyTable.innerHTML = '<tr><td colspan="8" class="loading-text" style="text-align:center; padding:20px;">加载中...</td></tr>';
        try {
            const list = await getAllStories();
            if (list && list.length > 0) {
                let html = '';
                list.forEach(story => {
                    html += `<tr>
                        <td>${story.id || ''}</td>
                        <td>${story.title || ''}</td>
                        <td>${story.content?.substring(0, 50) || ''}...</td>
                        <td>${story.pushDate || ''}</td>
                        <td>${story.type === 'story' ? '文化故事' : '景点推荐'}</td>
                        <td>${story.reason || ''}</td>
                        <td>${story.coverUrl ? `<img src="${story.coverUrl}" width="50">` : '无'}</td>
                        <td>
                            <button onclick="openStoryEditModal(${story.id})">编辑</button>
                            <button onclick="deleteCultureStory(${story.id})">删除</button>
                        </td>
                    </tr>`;
                });
                storyTable.innerHTML = html;
            } else {
                storyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">暂无文化故事数据</td></tr>';
            }
        } catch (err) {
            storyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:red;">加载失败，请重试</td></tr>';
        }
    }

    // 绑定新增故事表单提交事件（仅绑定一次，前端页面无需重复绑定）
    const storyForm = document.getElementById('storyForm');
    if (storyForm && !storyForm.dataset.binded) { // 标记已绑定，避免重复
        storyForm.dataset.binded = 'true';
        storyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storyData = {
                title: document.getElementById('storyTitle').value.trim(),
                content: document.getElementById('storyContent').value.trim(),
                coverUrl: document.getElementById('coverUrl').value.trim() || '',
                pushDate: document.getElementById('pushDate').value,
                type: document.getElementById('storyType').value,
                reason: document.getElementById('recommendReason').value.trim()
            };
            const result = await addCultureStory(storyData);
            if (result) {
                alert('新增成功！');
                storyForm.reset();
                await initStoryPage(); // 重新加载列表
            }
        });
    }
}

// 打卡页初始化
async function initCheckInPage() {
    const checkInTable = document.getElementById('checkInTable');
    if (checkInTable) {
        // 添加loading-text类标识加载元素
        checkInTable.innerHTML = '<tr><td colspan="6" class="loading-text" style="text-align:center; padding:20px;">加载中...</td></tr>';
        try {
            const list = await getAllCheckIns();
            
            if (list && list.length > 0) {
                let html = '';
                list.forEach(item => {
                    html += `<tr>
                        <td>${item.id || ''}</td>
                        <td>${item.userId || ''}</td>
                        <td>${item.checkInContent || ''}</td>
                        <td>${item.checkInTime || ''}</td>
                        <td>${item.location || ''}</td>
                        <td>
                            <button class="btn btn-edit" onclick="openCheckInEditModal(${item.id})">编辑</button>
                            <button class="btn btn-delete" onclick="deleteCheckIn(${item.id})">删除</button>
                        </td>
                    </tr>`;
                });
                checkInTable.innerHTML = html;
            } else {
                checkInTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">暂无打卡记录</td></tr>';
            }
        } catch (err) {
            console.error('打卡列表加载失败：', err);
            checkInTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:red;">加载失败，请重试</td></tr>';
        }
    }

    // 绑定新增打卡表单
    const checkInForm = document.getElementById('checkInForm');
    if (checkInForm && !checkInForm.dataset.binded) {
        checkInForm.dataset.binded = 'true';
        checkInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const checkInData = {
                userId: document.getElementById('userId').value.trim(),
                checkInContent: document.getElementById('checkInContent').value.trim(),
                checkInTime: document.getElementById('checkInTime').value,
                location: document.getElementById('location').value.trim()
            };
            const result = await addCheckIn(checkInData);
            if (result) {
                alert('打卡成功！');
                checkInForm.reset();
                await initCheckInPage(); // 重新加载列表
            }
        });
    }

    // 绑定编辑打卡表单
    const editForm = document.getElementById('editCheckInForm');
    if (editForm && !editForm.dataset.binded) {
        editForm.dataset.binded = 'true';
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const checkInData = {
                userId: document.getElementById('editUserId').value.trim(),
                checkInContent: document.getElementById('editCheckInContent').value.trim(),
                checkInTime: document.getElementById('editCheckInTime').value,
                location: document.getElementById('editLocation').value.trim()
            };
            const result = await updateCheckIn(id, checkInData);
            if (result) {
                alert('编辑成功！');
                closeCheckInEditModal();
                await initCheckInPage(); // 重新加载列表
            }
        });
    }
}

// 数字藏品页初始化
async function initCollectionPage() {
    const collectionTable = document.getElementById('collectionTable');
    if (collectionTable) {
        // 添加loading-text类标识加载元素
        collectionTable.innerHTML = '<tr><td colspan="10" class="loading-text" style="text-align:center; padding:20px;">加载中...</td></tr>';
        try {
            const list = await getAllCollections();
            
            if (list && list.length > 0) {
                let html = '';
                list.forEach(item => {
                    html += `<tr>
                        <td>${item.id || ''}</td>
                        <td>${item.name || ''}</td>
                        <td>${item.creator || ''}</td>
                        <td>${item.creatorInfo?.substring(0, 30) || ''}...</td>
                        <td>${item.price || 0} 元</td>
                        <td>${item.stock || 0}</td>
                        <td>${item.blockchainId || '无'}</td>
                        <td>${item.collectionCoverUrl ? `<img src="${item.collectionCoverUrl}" width="50">` : '无'}</td>
                        <td><button onclick="viewCollectionDetail(${item.id})">查看</button></td>
                        <td>
                            <button onclick="openCollectionEditModal(${item.id})">编辑</button>
                            <button onclick="deleteCultureCollection(${item.id})">删除</button>
                        </td>
                    </tr>`;
                });
                collectionTable.innerHTML = html;
            } else {
                collectionTable.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">暂无数字藏品</td></tr>';
            }
        } catch (err) {
            collectionTable.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:red;">加载失败，请重试</td></tr>';
        }
    }

    // 绑定新增藏品表单
    const collectionForm = document.getElementById('collectionForm');
    if (collectionForm && !collectionForm.dataset.binded) {
        collectionForm.dataset.binded = 'true';
        collectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const collectionData = {
                name: document.getElementById('collectionName').value.trim(),
                creator: document.getElementById('creator').value.trim(),
                creatorInfo: document.getElementById('creatorInfo').value.trim() || '',
                collectionCoverUrl: document.getElementById('collectionCoverUrl').value.trim() || '',
                detailUrl: document.getElementById('detailUrl').value.trim() || '',
                price: parseFloat(document.getElementById('price').value),
                blockchainId: document.getElementById('blockchainId').value.trim() || '',
                stock: parseInt(document.getElementById('stock').value)
            };
            const result = await addCultureCollection(collectionData);
            if (result) {
                alert('新增藏品成功！');
                collectionForm.reset();
                await initCollectionPage();
            }
        });
    }
}

// 个人足迹页初始化
async function initFootprintPage() {
    if (!isLogin) {
        alert('请先登录！');
        window.location.href = 'login.html';
        return;
    }

    const footprintTable = document.getElementById('footprintTable');
    if (footprintTable) {
        // 添加loading-text类标识加载元素
        footprintTable.innerHTML = '<tr><td colspan="6" class="loading-text" style="text-align:center;">加载中...</td></tr>';
        try {
            const list = await getMyFootprint();
            
            if (list && list.length > 0) {
                let html = '';
                list.forEach(item => {
                    html += `<tr>
                        <td>${item.id || ''}</td>
                        <td>${item.content || ''}</td>
                        <td>${item.location || ''}</td>
                        <td>${item.checkInTime || ''}</td>
                        <td>${item.footprintImg ? `<img src="${item.footprintImg}" width="60">` : '-'}</td>
                        <td><button class="btn btn-delete" onclick="deleteFootprint(${item.id})">删除</button></td>
                    </tr>`;
                });
                footprintTable.innerHTML = html;
            } else {
                footprintTable.innerHTML = '<tr><td colspan="6" style="text-align:center;">暂无个人足迹</td></tr>';
            }
        } catch (err) {
            footprintTable.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">加载失败，请重试</td></tr>';
        }
    }

    // 绑定新增足迹表单
    const footprintForm = document.getElementById('footprintForm');
    if (footprintForm && !footprintForm.dataset.binded) {
        footprintForm.dataset.binded = 'true';
        footprintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const footData = {
                content: document.getElementById('footprintContent').value.trim(),
                location: document.getElementById('footprintLocation').value.trim(),
                footprintImg: document.getElementById('footprintImg').value.trim() || '',
                checkInTime: new Date().toISOString().split('.')[0]
            };
            const result = await addUserFootprint(footData);
            if (result) {
                alert('足迹打卡成功！');
                footprintForm.reset();
                await initFootprintPage();
            }
        });
    }
}

// ====================== 通用弹窗函数 ======================
function openStoryEditModal(storyId) {
    // 修复：调用正确的getStoryById函数 + 弹窗居中
    getStoryById(storyId).then(story => {
        if (story) {
            document.getElementById('editStoryId').value = story.id;
            document.getElementById('editStoryTitle').value = story.title || '';
            document.getElementById('editStoryContent').value = story.content || '';
            document.getElementById('editCoverUrl').value = story.coverUrl || '';
            document.getElementById('editPushDate').value = story.pushDate || '';
            document.getElementById('editStoryType').value = story.type || 'story';
            document.getElementById('editRecommendReason').value = story.reason || '';
            // 改为flex显示，匹配CSS居中
            document.getElementById('editStoryModal').style.display = 'flex';
        }
    }).catch(error => {
        alert('加载故事数据失败：' + error.message);
    });
}

function closeStoryEditModal() {
    document.getElementById('editStoryModal').style.display = 'none';
}

function openCheckInEditModal(checkInId) {
    getCheckInById(checkInId).then(item => {
        if (item) {
            document.getElementById('editId').value = item.id;
            document.getElementById('editUserId').value = item.userId || '';
            document.getElementById('editCheckInContent').value = item.checkInContent || '';
            document.getElementById('editCheckInTime').value = item.checkInTime || '';
            document.getElementById('editLocation').value = item.location || '';
            document.getElementById('editModal').style.display = 'flex'; // 居中
        }
    }).catch(error => {
        alert('加载打卡数据失败：' + error.message);
    });
}

function closeCheckInEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function openCollectionEditModal(collectionId) {
    getCollectionById(collectionId).then(item => {
        if (item) {
            document.getElementById('editCollectionId').value = item.id;
            document.getElementById('editCollectionName').value = item.name || '';
            document.getElementById('editCreator').value = item.creator || '';
            document.getElementById('editCreatorInfo').value = item.creatorInfo || '';
            document.getElementById('editCollectionCoverUrl').value = item.collectionCoverUrl || '';
            document.getElementById('editDetailUrl').value = item.detailUrl || '';
            document.getElementById('editPrice').value = item.price || 0;
            document.getElementById('editBlockchainId').value = item.blockchainId || '';
            document.getElementById('editStock').value = item.stock || 0;
            document.getElementById('editCollectionModal').style.display = 'flex'; // 居中
        }
    }).catch(error => {
        alert('加载藏品数据失败：' + error.message);
    });
}

function closeCollectionEditModal() {
    document.getElementById('editCollectionModal').style.display = 'none';
}

function viewCollectionDetail(collectionId) {
    getCollectionById(collectionId).then(item => {
        if (item) {
            alert(`
                藏品详情：
                名称：${item.name}
                创作者：${item.creator}
                价格：${item.price} 元
                库存：${item.stock}
                区块链ID：${item.blockchainId || '无'}
            `);
        }
    }).catch(error => {
        alert('查看藏品详情失败：' + error.message);
    });
}

function showAlert(msg, type = "success") {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    alertBox.className = `alert ${type}`;
    alertBox.textContent = msg;
    setTimeout(() => {
        alertBox.className = 'alert';
    }, 3000);
}