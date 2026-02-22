import { db, LandBlock } from '../../utils/database';

Page({
  data: {
    contentList: [] as any[],
    landBlocks: [] as LandBlock[],
    landBlockFilter: [] as any[],
    landBlockFilterIndex: 0,
    searchKeyword: '',
    dateRange: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    showEditModal: false,
    editingContent: {} as any,
    updating: false
  },

  async onLoad() {
    if (!this.checkLoginStatus()) return;
    await this.loadLandBlocks();
    await this.loadContent();
  },

  onShow() {
    if (!this.checkLoginStatus()) return;
    // Reload when returning from detail/edit pages
    this.setData({ page: 1, hasMore: true, contentList: [] });
    this.loadContent();
  },

  async onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      contentList: []
    });
    await this.loadContent();
    wx.stopPullDownRefresh();
  },

  async onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      await this.loadMoreContent();
    }
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
    try {
      const userId = wx.getStorageSync('userId');
      const landBlocks = await db.getLandBlocks(userId);
      
      const filterOptions = [
        { id: 'all', name: '全部地块' },
        ...landBlocks
      ];
      
      this.setData({
        landBlocks,
        landBlockFilter: filterOptions
      });
    } catch (error) {
      console.error('Failed to load land blocks:', error);
    }
  },

  async loadContent() {
    if (this.data.loading) return;
    
    this.setData({
      loading: true
    });

    try {
      const userId = wx.getStorageSync('userId');
      const offset = (this.data.page - 1) * this.data.pageSize;
      
      let contentList = await db.getFruitInformation(userId, this.data.pageSize, offset);
      
      // Apply filters
      contentList = this.applyFilters(contentList);
      
      // Format dates and add land block names
      contentList = contentList.map(item => ({
        ...item,
        created_at: this.formatDate(new Date(item.created_at)),
        land_block_name: this.getLandBlockName(item.land_block_id),
        showAnalysis: false
      }));

      this.setData({
        contentList: this.data.page === 1 ? contentList : [...this.data.contentList, ...contentList],
        hasMore: contentList.length === this.data.pageSize,
        loading: false
      });

    } catch (error) {
      console.error('Failed to load content:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({
        loading: false
      });
    }
  },

  async loadMoreContent() {
    this.setData({
      page: this.data.page + 1
    });
    await this.loadContent();
  },

  applyFilters(contentList: any[]) {
    let filtered = [...contentList];

    // Search keyword filter
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase();
      filtered = filtered.filter(item => 
        item.content?.toLowerCase().includes(keyword) ||
        JSON.stringify(item.extracted_data)?.toLowerCase().includes(keyword)
      );
    }

    // Land block filter
    if (this.data.landBlockFilterIndex > 0) {
      const selectedLandBlock = this.data.landBlockFilter[this.data.landBlockFilterIndex];
      filtered = filtered.filter(item => item.land_block_id === selectedLandBlock.id);
    }

    // Date filter
    if (this.data.dateRange) {
      const targetDate = new Date(this.data.dateRange);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.created_at);
        return this.isSameDay(itemDate, targetDate);
      });
    }

    return filtered;
  },

  getLandBlockName(landBlockId: string): string {
    const landBlock = this.data.landBlocks.find(block => block.id === landBlockId);
    return landBlock?.name || '未知地块';
  },

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },

  onSearchInput(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  onSearchConfirm() {
    this.setData({
      page: 1,
      contentList: []
    });
    this.loadContent();
  },

  onLandBlockFilterChange(e: any) {
    this.setData({
      landBlockFilterIndex: parseInt(e.detail.value),
      page: 1,
      contentList: []
    });
    this.loadContent();
  },

  onDateRangeChange(e: any) {
    this.setData({
      dateRange: e.detail.value,
      page: 1,
      contentList: []
    });
    this.loadContent();
  },

  onContentItemTap(e: any) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/content-detail/content-detail?id=${id}`
      });
    }
  },

  toggleAnalysis(e: any) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    const contentList = this.data.contentList.map(item => {
      if (item.id === id) {
        return { ...item, showAnalysis: !item.showAnalysis };
      }
      return item;
    });
    
    this.setData({
      contentList
    });
  },

  editContent(e: any) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/content-edit/content-edit?id=${id}`
      });
    }
  },

  async deleteContent(e: any) {
    const id = e.currentTarget.dataset.id;
    
    const result = await this.showConfirmDialog('确认删除', '删除后无法恢复，确认删除吗？');
    if (!result) return;

    try {
      await db.deleteFruitInformation(id);
      
      const contentList = this.data.contentList.filter(item => item.id !== id);
      this.setData({
        contentList
      });
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('Delete failed:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  },

  showConfirmDialog(title: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: (res) => {
          resolve(res.confirm);
        }
      });
    });
  },

  hideEditModal() {
    this.setData({
      showEditModal: false,
      editingContent: {}
    });
  },

  onEditContentInput(e: any) {
    this.setData({
      'editingContent.content': e.detail.value
    });
  },

  onEditLandBlockChange(e: any) {
    this.setData({
      'editingContent.landBlockIndex': parseInt(e.detail.value)
    });
  },

  async saveEditContent() {
    this.setData({
      updating: true
    });

    try {
      const selectedLandBlock = this.data.landBlocks[this.data.editingContent.landBlockIndex];
      
      await db.updateFruitInformation(this.data.editingContent.id, {
        content: this.data.editingContent.content,
        land_block_id: selectedLandBlock.id
      });

      // Update local data
      const contentList = this.data.contentList.map(item => {
        if (item.id === this.data.editingContent.id) {
          return {
            ...item,
            content: this.data.editingContent.content,
            land_block_id: selectedLandBlock.id,
            land_block_name: selectedLandBlock.name
          };
        }
        return item;
      });

      this.setData({
        contentList,
        updating: false
      });

      this.hideEditModal();
      
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('Update failed:', error);
      wx.showToast({
        title: '更新失败',
        icon: 'error'
      });
      this.setData({
        updating: false
      });
    }
  },

  previewImage(e: any) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  goToAddContent() {
    wx.switchTab({
      url: '/pages/add-content/add-content'
    });
  }
});