import { db, FruitInformation } from '../../utils/database';

Page({
  data: {
    content: {} as FruitInformation,
    loading: true,
    landBlockName: '',
    showEditModal: false,
    editingContent: {} as any,
    landBlocks: [] as any[],
    updating: false,
    editingFertilizers: [] as any[],
    showAddFertilizerDialog: false,
    newFertilizer: {
      name: '',
      amount: '',
      unit: 'kg',
      type: '',
      npk_ratio: ''
    }
  },

  async onLoad(options: any) {
    if (!this.checkLoginStatus()) return;
    if (options.id) {
      await this.loadContent(options.id);
    }
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    if (!token || !userId) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  async loadContent(id: string) {
    try {
      this.setData({ loading: true });
      const userId = wx.getStorageSync('userId');

      let content: any = await db.findContentById(userId, id);

      if (!content) {
        // Fallback: search all records
        const allContent = await db.getAllFruitInformation(userId);
        content = allContent.find((item: any) => {
          return item.id === id ||
            item.id === parseInt(id) ||
            item.id?.toString() === id;
        });
      }

      if (!content) {
        wx.showToast({ title: '内容不存在', icon: 'error' });
        setTimeout(() => wx.navigateBack(), 2000);
        return;
      }

      const landBlocks = await db.getLandBlocks(userId);
      const landBlock = landBlocks.find((block: any) => block.id === content.land_block_id);

      const processedContent = this.processContentData(content);
      const formattedContent = {
        ...processedContent,
        formatted_created_at: this.formatDate(content.created_at?.toString() || ''),
        formatted_updated_at: content.updated_at ? this.formatDate(content.updated_at.toString()) : ''
      };

      this.setData({
        content: formattedContent,
        landBlockName: landBlock?.name || '未知地块',
        landBlocks,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load content:', error);
      wx.showToast({ title: '加载失败', icon: 'error' });
      wx.navigateBack();
    }
  },

  processContentData(content: any) {
    const processed = { ...content };

    let fertilizers: any[] | null = null;
    if (content.extracted_data?.fertilizers && Array.isArray(content.extracted_data.fertilizers)) {
      fertilizers = content.extracted_data.fertilizers;
    } else if (content.ai_analysis?.fertilizers && Array.isArray(content.ai_analysis.fertilizers)) {
      fertilizers = content.ai_analysis.fertilizers;
    } else if (content.fertilizer_recommendations && Array.isArray(content.fertilizer_recommendations)) {
      fertilizers = content.fertilizer_recommendations;
    }

    if (fertilizers && Array.isArray(fertilizers)) {
      processed.prioritized_fertilizers = fertilizers.map((fert: any) => ({
        name: fert.name || '未知肥料',
        amount: fert.amount || 0,
        unit: fert.unit || 'kg',
        type: fert.type || '',
        npk_ratio: fert.npk_ratio || '',
        application_method: fert.application_method || '',
        display: `${fert.name || '未知肥料'} ${fert.amount || 0}${fert.unit || 'kg'}`
      }));
      processed.total_fertilizer_count = processed.prioritized_fertilizers.length;
      processed.total_fertilizer_amount = processed.prioritized_fertilizers.reduce((sum: number, fert: any) => {
        return sum + (parseFloat(fert.amount) || 0);
      }, 0).toFixed(2);
    } else {
      processed.prioritized_fertilizers = [];
      processed.total_fertilizer_count = 0;
      processed.total_fertilizer_amount = '0.00';
    }

    processed.fruit_size = content.extracted_data?.fruit_size ||
      content.extracted_data?.size ||
      content.ai_analysis?.fruit_size ||
      content.fruit_size ||
      null;

    processed.crop_type = content.extracted_data?.crops ||
      content.ai_analysis?.crops ||
      content.fruit_type ||
      content.extracted_data?.crop_type ||
      '未知作物';

    processed.primary_description = content.description || content.content || '暂无描述';
    processed.secondary_info = content.extracted_data?.conditions ||
      content.extracted_data?.suggestions ||
      content.ai_analysis?.conditions ||
      content.ai_analysis?.suggestions ||
      '';

    return processed;
  },

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  previewImage() {
    const imgUrl = (this.data.content as any).img_url || (this.data.content as any).image_url;
    if (imgUrl) {
      wx.previewImage({ current: imgUrl, urls: [imgUrl] });
    }
  },

  editContent() {
    wx.navigateTo({
      url: `/pages/content-edit/content-edit?id=${(this.data.content as any).id}`
    });
  },

  async onShow() {
    // Reload content when returning from edit page
    const content = this.data.content as any;
    if (content && content.id && !this.data.loading) {
      await this.loadContent(content.id.toString());
    }
  },

  hideEditModal() {
    this.setData({ showEditModal: false, showAddFertilizerDialog: false });
  },

  onEditContentInput(e: any) {
    this.setData({ 'editingContent.primary_description': e.detail.value });
  },

  onEditLandBlockChange(e: any) {
    if (e && e.stopPropagation) e.stopPropagation();
    this.setData({ 'editingContent.landBlockIndex': parseInt(e.detail.value) });
  },

  showAddFertilizerDialog() {
    this.setData({ showAddFertilizerDialog: true });
  },

  hideAddFertilizerDialog() {
    this.setData({
      showAddFertilizerDialog: false,
      newFertilizer: { name: '', amount: '', unit: 'kg', type: '', npk_ratio: '' }
    });
  },

  onFertilizerNameInput(e: any) {
    this.setData({ 'newFertilizer.name': e.detail.value });
  },

  onFertilizerAmountInput(e: any) {
    this.setData({ 'newFertilizer.amount': e.detail.value });
  },

  onFertilizerUnitChange(e: any) {
    if (e && e.stopPropagation) e.stopPropagation();
    const units = ['kg', 'g', 'L', 'ml'];
    this.setData({ 'newFertilizer.unit': units[e.detail.value] });
  },

  onFertilizerTypeInput(e: any) {
    this.setData({ 'newFertilizer.type': e.detail.value });
  },

  onFertilizerNPKInput(e: any) {
    this.setData({ 'newFertilizer.npk_ratio': e.detail.value });
  },

  addFertilizer() {
    const newFert = this.data.newFertilizer;
    if (!newFert.name || !newFert.amount) {
      wx.showToast({ title: '请填写肥料名称和用量', icon: 'error' });
      return;
    }
    const fertilizer = {
      name: newFert.name,
      amount: parseFloat(newFert.amount) || 0,
      unit: newFert.unit,
      type: newFert.type,
      npk_ratio: newFert.npk_ratio,
      display: `${newFert.name} ${newFert.amount}${newFert.unit}`
    };
    const updatedFertilizers = [...this.data.editingFertilizers, fertilizer];
    this.setData({ editingFertilizers: updatedFertilizers });
    setTimeout(() => {
      this.hideAddFertilizerDialog();
      wx.showToast({ title: '肥料添加成功', icon: 'success' });
    }, 100);
  },

  deleteFertilizer(e: any) {
    const index = e.currentTarget.dataset.index;
    const updatedFertilizers = this.data.editingFertilizers.filter((_, i) => i !== index);
    this.setData({ editingFertilizers: updatedFertilizers });
    wx.showToast({ title: '肥料删除成功', icon: 'success' });
  },

  async saveEditContent() {
    this.setData({ updating: true });
    try {
      const selectedLandBlock = this.data.landBlocks[this.data.editingContent.landBlockIndex];
      const contentData = this.data.content as any;
      const updateData = {
        content: this.data.editingContent.primary_description,
        land_block_id: selectedLandBlock.id,
        extracted_data: {
          ...(contentData.extracted_data || {}),
          fertilizers: this.data.editingFertilizers,
          crops: this.data.editingContent.crop_type,
          fruit_size: this.data.editingContent.fruit_size
        }
      };
      await db.updateFruitInformation(contentData.id, updateData);
      await this.loadContent(contentData.id.toString());
      this.hideEditModal();
      wx.showToast({ title: '保存成功', icon: 'success', duration: 2000 });
    } catch (error) {
      console.error('Update failed:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'error', duration: 2000 });
    } finally {
      this.setData({ updating: false });
    }
  },

  async deleteContent() {
    const result = await this.showConfirmDialog('确认删除', '删除后无法恢复，确认删除吗？');
    if (!result) return;
    try {
      await db.deleteFruitInformation((this.data.content as any).id);
      wx.showToast({ title: '删除成功', icon: 'success' });
      wx.navigateBack({
        success: () => {
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const prevPage = pages[pages.length - 1];
            if (prevPage && typeof (prevPage as any).onPullDownRefresh === 'function') {
              (prevPage as any).onPullDownRefresh();
            }
          }
        }
      });
    } catch (error) {
      console.error('Delete failed:', error);
      wx.showToast({ title: '删除失败', icon: 'error' });
    }
  },

  showConfirmDialog(title: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({ title, content, success: (res) => resolve(res.confirm) });
    });
  },

  onShareAppMessage() {
    return {
      title: '农业信息分享',
      path: `/pages/content-detail/content-detail?id=${(this.data.content as any).id}`
    };
  },

  goBack() {
    wx.navigateBack();
  }
});
