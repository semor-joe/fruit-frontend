import { db } from '../../utils/database';

Page({
  data: {
    contentId: '',
    content: {} as any,
    processedContent: {} as any,
    landBlocks: [] as any[],
    selectedLandBlockIndex: 0,
    editingFertilizers: [] as any[],
    newFertilizer: { name: '', amount: '', unit: 'kg', type: '', npk_ratio: '' },
    editingFertilizer: { index: -1, name: '', amount: '', unit: 'kg', type: '', npk_ratio: '' },
    showAddFertilizerDialog: false,
    showEditFertilizerDialog: false,
    updating: false,
    editableDate: '',
    editableCropType: '',
    editableFruitSize: ''
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ contentId: options.id });
      this.loadContent(options.id);
      this.loadLandBlocks();
    }
  },

  async loadContent(contentId: string) {
    try {
      wx.showLoading({ title: '加载中...' });
      const userId = wx.getStorageSync('userId');
      const content = await db.findContentById(userId, contentId);

      if (!content) {
        wx.showToast({ title: '内容未找到', icon: 'error' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const processedContent = this.processContentData(content as any);
      const existingFertilizers = this.extractFertilizerData(content as any);

      this.setData({
        content: content as any,
        processedContent,
        editingFertilizers: existingFertilizers,
        editableDate: (content as any).created_at || '',
        editableCropType: processedContent.crop_type,
        editableFruitSize: processedContent.fruit_size
      });
    } catch (error) {
      console.error('Failed to load content:', error);
      wx.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  processContentData(content: any) {
    const processed: any = {
      id: content.id,
      img_url: content.img_url || '',
      created_at: content.created_at || '',
      land_block_name: '未知地块',
      prioritized_fertilizers: [],
      total_fertilizer_count: 0,
      total_fertilizer_amount: '0kg',
      fruit_size: '',
      crop_type: '未知作物',
      primary_description: content.description || content.content || '暂无描述',
      secondary_info: ''
    };

    let allFertilizers: any[] = [];
    if (content.extracted_data?.fertilizers) allFertilizers = allFertilizers.concat(content.extracted_data.fertilizers);
    if (content.ai_analysis?.fertilizers) allFertilizers = allFertilizers.concat(content.ai_analysis.fertilizers);
    if (content.fertilizer_recommendations) allFertilizers = allFertilizers.concat(content.fertilizer_recommendations);
    processed.prioritized_fertilizers = allFertilizers.filter((f: any) => f && (f.name || f.fertilizer_name));
    processed.total_fertilizer_count = processed.prioritized_fertilizers.length;
    let totalAmount = 0;
    processed.prioritized_fertilizers.forEach((f: any) => { totalAmount += parseFloat(f.amount || 0) || 0; });
    processed.total_fertilizer_amount = `${totalAmount}kg`;

    processed.fruit_size = content.extracted_data?.fruit_size || content.ai_analysis?.fruit_size || content.extracted_data?.size || '中等大小';
    processed.crop_type = content.extracted_data?.crops || content.ai_analysis?.crops || content.extracted_data?.crop_type || content.ai_analysis?.crop_type || '未知作物';

    return processed;
  },

  extractFertilizerData(content: any): any[] {
    let fertilizers: any[] = [];
    const extract = (list: any[]) => list.filter((f: any) => !fertilizers.some(e => e.name === (f.name || f.fertilizer_name))).map((f: any) => ({
      name: f.name || f.fertilizer_name || 'Unknown',
      amount: f.amount || f.quantity || 0,
      unit: f.unit || 'kg',
      type: f.type || f.fertilizer_type || '',
      npk_ratio: f.npk_ratio || f.npk || '',
      display: f.display || `${f.name || f.fertilizer_name} ${f.amount || f.quantity}${f.unit || 'kg'}`
    }));
    if (content.extracted_data?.fertilizers) fertilizers = fertilizers.concat(extract(content.extracted_data.fertilizers));
    if (content.ai_analysis?.fertilizers) fertilizers = fertilizers.concat(extract(content.ai_analysis.fertilizers));
    if (content.fertilizer_recommendations) fertilizers = fertilizers.concat(extract(content.fertilizer_recommendations));
    return fertilizers;
  },

  async loadLandBlocks() {
    try {
      const userId = wx.getStorageSync('userId');
      if (!userId) return;
      const landBlocks = await db.getLandBlocks(userId);
      let selectedIndex = 0;
      if (this.data.content.land_block_id) {
        const found = landBlocks.findIndex((b: any) => b.id === this.data.content.land_block_id);
        if (found !== -1) selectedIndex = found;
      }
      this.setData({ landBlocks, selectedLandBlockIndex: selectedIndex });
    } catch (error) {
      console.error('Failed to load land blocks:', error);
    }
  },

  previewImage() {
    const url = this.data.processedContent.img_url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  },

  onDescriptionInput(e: any) {
    this.setData({ 'processedContent.primary_description': e.detail.value });
  },

  onLandBlockChange(e: any) {
    this.setData({ selectedLandBlockIndex: parseInt(e.detail.value) });
  },

  onDateInput(e: any) {
    this.setData({ editableDate: e.detail.value });
  },

  onCropTypeInput(e: any) {
    this.setData({ editableCropType: e.detail.value });
  },

  onFruitSizeInput(e: any) {
    this.setData({ editableFruitSize: e.detail.value });
  },

  showAddFertilizerDialog() {
    this.setData({ showAddFertilizerDialog: true, newFertilizer: { name: '', amount: '', unit: 'kg', type: '', npk_ratio: '' } });
  },

  hideAddFertilizerDialog() {
    this.setData({ showAddFertilizerDialog: false });
  },

  onFertilizerNameInput(e: any) { this.setData({ 'newFertilizer.name': e.detail.value }); },
  onFertilizerAmountInput(e: any) { this.setData({ 'newFertilizer.amount': e.detail.value }); },
  onFertilizerUnitChange(e: any) {
    const units = ['kg', 'g', 'L', 'ml'];
    this.setData({ 'newFertilizer.unit': units[e.detail.value] });
  },
  onFertilizerTypeInput(e: any) { this.setData({ 'newFertilizer.type': e.detail.value }); },
  onFertilizerNPKInput(e: any) { this.setData({ 'newFertilizer.npk_ratio': e.detail.value }); },

  addFertilizer() {
    const f = this.data.newFertilizer;
    if (!f.name || !f.amount) { wx.showToast({ title: '请填写肥料名称和用量', icon: 'error' }); return; }
    const fertilizer = { name: f.name, amount: parseFloat(f.amount) || 0, unit: f.unit, type: f.type, npk_ratio: f.npk_ratio, display: `${f.name} ${f.amount}${f.unit}` };
    this.setData({ editingFertilizers: [...this.data.editingFertilizers, fertilizer] });
    this.hideAddFertilizerDialog();
    wx.showToast({ title: '肥料添加成功', icon: 'success' });
  },

  editFertilizer(e: any) {
    const index = e.currentTarget.dataset.index;
    const f = this.data.editingFertilizers[index];
    this.setData({
      showEditFertilizerDialog: true,
      editingFertilizer: { index, name: f.name, amount: f.amount.toString(), unit: f.unit, type: f.type || '', npk_ratio: f.npk_ratio || '' }
    });
  },

  hideEditFertilizerDialog() {
    this.setData({ showEditFertilizerDialog: false, editingFertilizer: { index: -1, name: '', amount: '', unit: 'kg', type: '', npk_ratio: '' } });
  },

  onEditFertilizerNameInput(e: any) { this.setData({ 'editingFertilizer.name': e.detail.value }); },
  onEditFertilizerAmountInput(e: any) { this.setData({ 'editingFertilizer.amount': e.detail.value }); },
  onEditFertilizerUnitChange(e: any) {
    const units = ['kg', 'g', 'L', 'ml'];
    this.setData({ 'editingFertilizer.unit': units[e.detail.value] });
  },
  onEditFertilizerTypeInput(e: any) { this.setData({ 'editingFertilizer.type': e.detail.value }); },
  onEditFertilizerNPKInput(e: any) { this.setData({ 'editingFertilizer.npk_ratio': e.detail.value }); },

  saveFertilizerEdit() {
    const ef = this.data.editingFertilizer;
    if (!ef.name || !ef.amount) { wx.showToast({ title: '请填写肥料名称和用量', icon: 'error' }); return; }
    const updated = [...this.data.editingFertilizers];
    updated[ef.index] = { name: ef.name, amount: parseFloat(ef.amount) || 0, unit: ef.unit, type: ef.type, npk_ratio: ef.npk_ratio, display: `${ef.name} ${ef.amount}${ef.unit}` };
    this.setData({ editingFertilizers: updated });
    this.hideEditFertilizerDialog();
    wx.showToast({ title: '肥料修改成功', icon: 'success' });
  },

  deleteFertilizer(e: any) {
    const index = e.currentTarget.dataset.index;
    this.setData({ editingFertilizers: this.data.editingFertilizers.filter((_, i) => i !== index) });
    wx.showToast({ title: '肥料删除成功', icon: 'success' });
  },

  async saveContent() {
    this.setData({ updating: true });
    try {
      const selectedLandBlock = this.data.landBlocks[this.data.selectedLandBlockIndex];
      const updateData = {
        content: this.data.processedContent.primary_description,
        land_block_id: selectedLandBlock.id,
        extracted_data: {
          ...(this.data.content.extracted_data || {}),
          fertilizers: this.data.editingFertilizers,
          crops: this.data.editableCropType,
          fruit_size: this.data.editableFruitSize
        }
      };
      await db.updateFruitInformation(this.data.contentId, updateData);
      wx.showToast({ title: '保存成功', icon: 'success', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
    } catch (error) {
      console.error('Save failed:', error);
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      this.setData({ updating: false });
    }
  },

  cancelEdit() {
    wx.showModal({
      title: '确认取消',
      content: '当前修改尚未保存，确定要离开吗？',
      success: (res) => { if (res.confirm) wx.navigateBack(); }
    });
  }
});
