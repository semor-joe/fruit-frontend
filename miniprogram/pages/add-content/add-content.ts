import { db, LandBlock } from '../../utils/database';

Page({
  data: {
    landBlocks: [] as LandBlock[],
    landBlockIndex: 0,
    inputText: '',
    uploadedImages: [] as any[],
    analysisResult: null as any,
    analyzing: false,
    saving: false,
    showAddLandBlock: false,
    creatingLandBlock: false,
    newLandBlock: {
      name: '',
      description: ''
    }
  },

  async onLoad() {
    if (!this.checkLoginStatus()) return;
    await this.loadLandBlocks();
  },

  onShow() {
    if (!this.checkLoginStatus()) return;
    // Refresh land blocks when returning from management page
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
    try {
      const userId = wx.getStorageSync('userId');
      const token = wx.getStorageSync('token');
      
      console.log('Loading land blocks for user:', userId);
      console.log('Using token:', token ? 'present' : 'missing');
      
      const landBlocks = await db.getLandBlocks(userId);
      
      console.log('API response land blocks:', landBlocks);
      console.log('Land blocks type:', typeof landBlocks);
      console.log('Land blocks length:', Array.isArray(landBlocks) ? landBlocks.length : 'not array');
      
      this.setData({
        landBlocks: landBlocks || []
      });
      
      // If no land blocks exist, show inline prompt instead of a modal popup
      // User can tap '新增地块' button to create one
    } catch (error: any) {
      console.error('Failed to load land blocks:', error);
      wx.showToast({
        title: `加载地块失败: ${error?.message || '未知错误'}`,
        icon: 'error',
        duration: 2000
      });
    }
  },

  onLandBlockChange(e: any) {
    this.setData({
      landBlockIndex: parseInt(e.detail.value)
    });
  },

  onTextInput(e: any) {
    this.setData({
      inputText: e.detail.value
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.uploadedImages.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          url: file.tempFilePath,
          size: file.size
        }));
        
        this.setData({
          uploadedImages: [...this.data.uploadedImages, ...newImages]
        });
      },
      fail: (error) => {
        console.error('Choose image failed:', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  previewImage(e: any) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.uploadedImages.map(img => img.url);
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  deleteImage(e: any) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.uploadedImages;
    images.splice(index, 1);
    
    this.setData({
      uploadedImages: images
    });
  },

  async analyzeContent() {
    if (!this.data.inputText && this.data.uploadedImages.length === 0) {
      wx.showToast({
        title: '请输入文本或上传图片',
        icon: 'error'
      });
      return;
    }

    if (!this.data.landBlocks || this.data.landBlocks.length === 0) {
      wx.showToast({
        title: '请先创建地块',
        icon: 'error'
      });
      this.showAddLandBlockDialog();
      return;
    }

    this.setData({
      analyzing: true
    });

    try {
      let analysisData: any = {};

      // Analyze text if provided
      if (this.data.inputText) {
        const selectedLandBlock = this.data.landBlocks[this.data.landBlockIndex];
        const textAnalysis = await db.analyzeText(this.data.inputText, selectedLandBlock.id);
        analysisData = { ...analysisData, ...textAnalysis };
      }

      // Upload and analyze images if provided
      if (this.data.uploadedImages.length > 0) {
        const imageAnalyses = await Promise.all(
          this.data.uploadedImages.map(async (img) => {
            const uploadResult = await db.uploadImage(img.url);
            const analysis = await db.analyzeImage(uploadResult.id);
            return analysis;
          })
        );

        // Merge image analysis results
        imageAnalyses.forEach(analysis => {
          if (analysis.content) {
            const imageData = JSON.parse(analysis.content);
            analysisData = this.mergeAnalysisData(analysisData, imageData);
          }
        });
      }

      this.setData({
        analysisResult: analysisData,
        analyzing: false
      });

      wx.showToast({
        title: '分析完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('Analysis failed:', error);
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'error'
      });
      this.setData({
        analyzing: false
      });
    }
  },

  mergeAnalysisData(existing: any, newData: any) {
    const merged = { ...existing };

    if (newData.fertilizers) {
      merged.fertilizers = [...(merged.fertilizers || []), ...newData.fertilizers];
    }
    if (newData.crops) {
      merged.crops = merged.crops ? `${merged.crops}; ${newData.crops}` : newData.crops;
    }
    if (newData.conditions) {
      merged.conditions = merged.conditions ? `${merged.conditions}; ${newData.conditions}` : newData.conditions;
    }
    if (newData.suggestions) {
      merged.suggestions = merged.suggestions ? `${merged.suggestions}; ${newData.suggestions}` : newData.suggestions;
    }

    return merged;
  },

  async saveContent() {
    if (!this.data.analysisResult) {
      wx.showToast({
        title: '请先进行AI分析',
        icon: 'error'
      });
      return;
    }

    if (!this.data.landBlocks || this.data.landBlocks.length === 0) {
      wx.showToast({
        title: '请先创建地块',
        icon: 'error'
      });
      this.showAddLandBlockDialog();
      return;
    }

    this.setData({
      saving: true
    });

    try {
      const selectedLandBlock = this.data.landBlocks[this.data.landBlockIndex];
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save fertilizers first
      const fertilizerIds = [];
      if (this.data.analysisResult.fertilizers) {
        for (const fert of this.data.analysisResult.fertilizers) {
          const fertilizer = await db.createFertilizer({
            name: fert.name,
            amount: parseFloat(fert.amount) || 0,
            unit: fert.unit || 'kg',
            description: `AI识别 - ${new Date().toISOString()}`
          });
          fertilizerIds.push(fertilizer.id);
        }
      }

      // Save fruit information
      await db.createFruitInformation({
        land_block_id: selectedLandBlock.id,
        session_id: sessionId,
        img_url: this.data.uploadedImages[0]?.url || '',
        fertilizer_ids: fertilizerIds,
        content: this.data.inputText,
        extracted_data: this.data.analysisResult
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // Reset form
      this.setData({
        inputText: '',
        uploadedImages: [],
        analysisResult: null,
        saving: false
      });

    } catch (error) {
      console.error('Save failed:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'error'
      });
      this.setData({
        saving: false
      });
    }
  },

  showAddLandBlockDialog() {
    this.setData({
      showAddLandBlock: true
    });
  },

  hideAddLandBlockDialog() {
    this.setData({
      showAddLandBlock: false,
      newLandBlock: {
        name: '',
        description: ''
      }
    });
  },

  onNewLandBlockNameInput(e: any) {
    this.setData({
      'newLandBlock.name': e.detail.value
    });
  },

  onNewLandBlockDescInput(e: any) {
    this.setData({
      'newLandBlock.description': e.detail.value
    });
  },

  async createLandBlock() {
    if (!this.data.newLandBlock.name.trim()) {
      wx.showToast({
        title: '请输入地块名称',
        icon: 'error'
      });
      return;
    }

    // Check for duplicate names
    const existingNames = this.data.landBlocks.map(block => block.name.toLowerCase());
    if (existingNames.includes(this.data.newLandBlock.name.trim().toLowerCase())) {
      wx.showToast({
        title: '地块名称已存在',
        icon: 'error'
      });
      return;
    }

    this.setData({
      creatingLandBlock: true
    });

    try {
      console.log('Creating land block with data:', {
        name: this.data.newLandBlock.name,
        description: this.data.newLandBlock.description,
        location: '',
        area: undefined
      });
      
      const newLandBlock = await db.createLandBlock({
        name: this.data.newLandBlock.name,
        description: this.data.newLandBlock.description,
        location: '', // Optional field
        area: undefined // Optional field
      });

      console.log('Created new land block:', newLandBlock);
      console.log('New land block type:', typeof newLandBlock);
      console.log('New land block ID:', newLandBlock?.id);

      // Reload land blocks from server
      await this.loadLandBlocks();
      
      // Wait a bit for data to settle, then select the newly created land block
      setTimeout(() => {
        const landBlocks = this.data.landBlocks;
        const newIndex = landBlocks.findIndex(block => block.id === newLandBlock.id);
        console.log('Looking for new land block ID:', newLandBlock.id, 'in blocks:', landBlocks);
        
        if (newIndex >= 0) {
          this.setData({
            landBlockIndex: newIndex
          });
          console.log('Selected new land block at index:', newIndex);
        } else {
          // If not found by ID, select the last one (most recently created)
          if (landBlocks.length > 0) {
            this.setData({
              landBlockIndex: landBlocks.length - 1
            });
          }
        }
      }, 100);

      this.hideAddLandBlockDialog();
      wx.showToast({
        title: '地块创建成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('Create land block failed:', error);
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'error'
      });
    } finally {
      this.setData({
        creatingLandBlock: false
      });
    }
  },

  manageLandBlocks() {
    wx.navigateTo({
      url: '/pages/manage-landblocks/manage-landblocks'
    });
  }
});