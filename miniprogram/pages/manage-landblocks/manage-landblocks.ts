import { db, LandBlock } from '../../utils/database';

Page({
  data: {
    landBlocks: [] as LandBlock[],
    loading: false,
    showEditModal: false,
    showDeleteConfirm: false,
    editingLandBlock: {} as LandBlock,
    deletingLandBlock: {} as LandBlock,
    updating: false,
    deleting: false
  },

  onLoad() {
    if (!this.checkLoginStatus()) return;
    this.loadLandBlocks();
  },

  onShow() {
    if (!this.checkLoginStatus()) return;
    // Reload land blocks when returning from other pages
    this.loadLandBlocks();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    
    if (!token || !userId) {
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  async loadLandBlocks() {
    this.setData({ loading: true });
    
    try {
      const userId = wx.getStorageSync('userId');
      const landBlocks = await db.getLandBlocks(userId);
      
      console.log('Loaded land blocks for management:', landBlocks);
      
      this.setData({
        landBlocks: landBlocks || [],
        loading: false
      });

    } catch (error: any) {
      console.error('Failed to load land blocks:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
  },

  async onPullDownRefresh() {
    await this.loadLandBlocks();
    wx.stopPullDownRefresh();
  },

  // Edit Land Block
  editLandBlock(e: any) {
    const id = e.currentTarget.dataset.id;
    const landBlock = this.data.landBlocks.find(block => block.id === id);
    
    if (landBlock) {
      this.setData({
        showEditModal: true,
        editingLandBlock: { ...landBlock }
      });
    }
  },

  hideEditModal() {
    this.setData({
      showEditModal: false,
      editingLandBlock: {} as LandBlock
    });
  },

  onEditNameInput(e: any) {
    this.setData({
      'editingLandBlock.name': e.detail.value
    });
  },

  onEditLocationInput(e: any) {
    this.setData({
      'editingLandBlock.location': e.detail.value
    });
  },

  onEditAreaInput(e: any) {
    this.setData({
      'editingLandBlock.area': parseFloat(e.detail.value) || 0
    });
  },

  onEditDescriptionInput(e: any) {
    this.setData({
      'editingLandBlock.description': e.detail.value
    });
  },

  async saveEditLandBlock() {
    const editingLandBlock = this.data.editingLandBlock;
    
    if (!editingLandBlock.name.trim()) {
      wx.showToast({
        title: '请输入地块名称',
        icon: 'error'
      });
      return;
    }

    // Check for duplicate names (excluding current land block)
    const existingNames = this.data.landBlocks
      .filter(block => block.id !== editingLandBlock.id)
      .map(block => block.name.toLowerCase());
    
    if (existingNames.includes(editingLandBlock.name.trim().toLowerCase())) {
      wx.showToast({
        title: '地块名称已存在',
        icon: 'error'
      });
      return;
    }

    this.setData({ updating: true });

    try {
      const updatedLandBlock = await db.updateLandBlock(editingLandBlock.id, {
        name: editingLandBlock.name.trim(),
        location: editingLandBlock.location || '',
        area: editingLandBlock.area || 0,
        description: editingLandBlock.description || ''
      });

      // Update local data
      const landBlocks = this.data.landBlocks.map(block => 
        block.id === editingLandBlock.id ? updatedLandBlock : block
      );

      this.setData({
        landBlocks,
        updating: false
      });

      this.hideEditModal();
      
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      });

    } catch (error: any) {
      console.error('Update land block failed:', error);
      wx.showToast({
        title: `更新失败: ${error?.message || '未知错误'}`,
        icon: 'error'
      });
      this.setData({ updating: false });
    }
  },

  // Delete Land Block
  deleteLandBlock(e: any) {
    const id = e.currentTarget.dataset.id;
    const landBlock = this.data.landBlocks.find(block => block.id === id);
    
    if (landBlock) {
      this.setData({
        showDeleteConfirm: true,
        deletingLandBlock: landBlock
      });
    }
  },

  hideDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
      deletingLandBlock: {} as LandBlock
    });
  },

  async confirmDeleteLandBlock() {
    const deletingLandBlock = this.data.deletingLandBlock;
    
    this.setData({ deleting: true });

    try {
      await db.deleteLandBlock(deletingLandBlock.id);

      const landBlocks = this.data.landBlocks.filter(
        block => block.id !== deletingLandBlock.id
      );

      this.setData({
        landBlocks,
        deleting: false
      });

      this.hideDeleteConfirm();
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });

    } catch (error: any) {
      console.error('Delete land block failed:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'error',
        duration: 3000
      });
      this.setData({ deleting: false });
    }
  },

  // View Land Block Details
  viewLandBlockDetails(e: any) {
    const id = e.currentTarget.dataset.id;
    
    wx.navigateTo({
      url: `/pages/landblock-detail/landblock-detail?id=${id}`
    });
  },

  // Add New Land Block
  addNewLandBlock() {
    wx.navigateBack();
    // The parent page will handle showing the add dialog
    setTimeout(() => {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 1];
      if (prevPage && typeof prevPage.showAddLandBlockDialog === 'function') {
        prevPage.showAddLandBlockDialog();
      }
    }, 500);
  },

  // Format date for display
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Get statistics for land block (if available)
  async getLandBlockStats() {
    try {
      // This would call a stats endpoint if implemented
      const stats = await db.getStatistics(wx.getStorageSync('userId'), {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      });
      return stats;
    } catch (error) {
      console.error('Failed to get land block stats:', error);
      return null;
    }
  }
});