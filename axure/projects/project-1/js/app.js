// 应用入口
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 产品管理原型已加载');

  // 初始化所有模块
  initDropdown();
  initSearch();
  initTable();
  initForm();
  initModal();
  initToast();
  initViewToggle();
  initPagination();
});

// ========================================
// 下拉菜单功能
// ========================================
function initDropdown() {
  const userMenu = document.querySelector('.user-menu');
  const dropdownMenu = document.querySelector('.dropdown-menu');

  userMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) {
      dropdownMenu.style.opacity = '0';
      dropdownMenu.style.visibility = 'hidden';
    }
  });
}

// ========================================
// 搜索功能
// ========================================
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.querySelector('.search-box .btn-icon');

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  function performSearch() {
    const keyword = searchInput.value.trim();
    if (keyword) {
      showToast(`🔍 搜索：${keyword}`, 'info');
      filterTable(keyword);
    } else {
      showToast('请输入搜索关键词', 'warning');
    }
  }

  function filterTable(keyword) {
    const rows = document.querySelectorAll('#productTableBody tr');
    const lowerKeyword = keyword.toLowerCase();

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(lowerKeyword) ? '' : 'none';
    });
  }
}

// ========================================
// 表格功能
// ========================================
function initTable() {
  // 全选功能
  const selectAll = document.getElementById('selectAll');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');

  selectAll.addEventListener('change', () => {
    rowCheckboxes.forEach(cb => {
      cb.checked = selectAll.checked;
    });
    updateSelectedCount();
  });

  rowCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      updateSelectedCount();
      // 检查是否全部选中
      const allChecked = Array.from(rowCheckboxes).every(c => c.checked);
      selectAll.checked = allChecked;
    });
  });

  function updateSelectedCount() {
    const selected = Array.from(rowCheckboxes).filter(c => c.checked).length;
    if (selected > 0) {
      showToast(`已选择 ${selected} 项`, 'info');
    }
  }

  // 操作按钮事件
  document.querySelectorAll('.btn-icon-sm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const title = btn.getAttribute('title');
      const row = btn.closest('tr');
      const productName = row.querySelector('.product-name').textContent.trim();

      if (title === '编辑') {
        showToast(`✏️ 编辑：${productName}`, 'info');
      } else if (title === '查看') {
        showToast(`👁️ 查看：${productName}`, 'info');
      } else if (title === '删除') {
        openModal(productName);
      }
    });
  });

  // 分类筛选
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');

  [categoryFilter, statusFilter].forEach(select => {
    select.addEventListener('change', filterTableBySelect);
  });

  function filterTableBySelect() {
    const category = categoryFilter.value;
    const status = statusFilter.value;
    const rows = document.querySelectorAll('#productTableBody tr');

    rows.forEach(row => {
      let show = true;
      
      if (category) {
        const badge = row.querySelector('.badge');
        const rowCategory = badge.className.includes(getCategoryClass(category)) ? true : false;
        // 简化处理，实际应该更精确匹配
      }
      
      if (status) {
        const badges = row.querySelectorAll('.badge');
        const statusText = Array.from(badges).find(b => 
          b.textContent === '进行中' || b.textContent === '已完成' || b.textContent === '已暂停'
        )?.textContent;
        if (statusText !== getStatusText(status)) {
          show = false;
        }
      }

      row.style.display = show ? '' : 'none';
    });

    showToast('筛选已应用', 'success');
  }

  function getCategoryClass(cat) {
    const map = {
      electronics: 'badge-purple',
      software: 'badge-blue',
      hardware: 'badge-orange',
      service: 'badge-green'
    };
    return map[cat] || '';
  }

  function getStatusText(status) {
    const map = {
      active: '进行中',
      completed: '已完成',
      paused: '已暂停'
    };
    return map[status] || '';
  }
}

// ========================================
// 表单功能
// ========================================
function initForm() {
  const form = document.getElementById('productForm');
  const addProductBtn = document.getElementById('addProductBtn');

  // 表单提交
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    console.log('表单数据:', data);
    
    // 模拟添加产品
    addProductToTable(data);
    
    showToast('✅ 产品创建成功！', 'success');
    form.reset();
  });

  // 新建产品按钮
  addProductBtn.addEventListener('click', () => {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('productName').focus();
  });

  // 表单验证反馈
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
    field.addEventListener('blur', () => {
      if (!field.value.trim()) {
        field.style.borderColor = '#e74c3c';
      } else {
        field.style.borderColor = '#e8e8e8';
      }
    });

    field.addEventListener('focus', () => {
      field.style.borderColor = '#667eea';
    });
  });
}

function addProductToTable(data) {
  const tbody = document.getElementById('productTableBody');
  const icons = { electronics: '🖥️', software: '📱', hardware: '⚙️', service: '📋' };
  const icon = icons[data.productCategory] || '📦';
  
  const newRow = `
    <tr>
      <td><input type="checkbox" class="row-checkbox"></td>
      <td>
        <div class="product-name">
          <span class="product-icon">${icon}</span>
          ${data.productName}
        </div>
      </td>
      <td><span class="badge badge-blue">${data.productCategory}</span></td>
      <td><span class="badge badge-green">进行中</span></td>
      <td>
        <img src="https://ui-avatars.com/api/?name=New&background=random" class="mini-avatar">
        新用户
      </td>
      <td>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <span class="progress-text">0%</span>
      </td>
      <td>${new Date().toISOString().split('T')[0]}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon-sm" title="编辑">✏️</button>
          <button class="btn-icon-sm" title="查看">👁️</button>
          <button class="btn-icon-sm danger" title="删除">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  
  tbody.insertAdjacentHTML('afterbegin', newRow);
  
  // 重新绑定事件
  const newRowEl = tbody.querySelector('tr:first-child');
  newRowEl.querySelectorAll('.btn-icon-sm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const title = btn.getAttribute('title');
      const productName = newRowEl.querySelector('.product-name').textContent.trim();
      
      if (title === '删除') {
        openModal(productName);
      } else {
        showToast(`${title}: ${productName}`, 'info');
      }
    });
  });
}

// ========================================
// 模态框功能
// ========================================
function initModal() {
  // 模态框相关变量
  window.currentDeleteProduct = null;
}

function openModal(productName) {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('active');
  window.currentDeleteProduct = productName;
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  window.currentDeleteProduct = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalConfirm').addEventListener('click', () => {
  if (window.currentDeleteProduct) {
    showToast(`🗑️ 已删除：${window.currentDeleteProduct}`, 'success');
    closeModal();
  }
});

// 点击遮罩层关闭
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeModal();
  }
});

// ESC 键关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ========================================
// Toast 消息提示
// ========================================
function initToast() {
  // 初始化容器
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // 3 秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// 视图切换功能
// ========================================
function initViewToggle() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const view = btn.dataset.view;
      showToast(`切换到${view === 'list' ? '列表' : '网格'}视图`, 'info');
      
      // 这里可以添加实际的视图切换逻辑
    });
  });
}

// ========================================
// 分页功能
// ========================================
function initPagination() {
  const paginationBtns = document.querySelectorAll('.btn-pagination');
  
  paginationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled || btn.textContent === '...') return;
      
      paginationBtns.forEach(b => b.classList.remove('active'));
      if (!btn.textContent.includes('页')) {
        btn.classList.add('active');
      }
      
      const page = btn.textContent;
      if (!isNaN(page)) {
        showToast(`跳转到第 ${page} 页`, 'info');
      }
    });
  });
}

// ========================================
// 工具函数
// ========================================
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;

console.log('✅ 所有模块初始化完成');
