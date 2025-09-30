import { db } from '../../utils/database';

Page({
  data: {
    startDate: '',
    endDate: '',
    loading: false,
    statistics: {
      totalRecords: 0,
      totalLandBlocks: 0,
      totalImages: 0,
      totalFertilizers: 0,
      landBlockStats: [] as any[],
      fertilizerStats: [] as any[],
      recentActivity: [] as any[],
      insights: [] as string[]
    }
  },

  onLoad() {
    if (!this.checkLoginStatus()) return;
    this.initializeDates();
    this.loadStatistics();
  },

  onShow() {
    if (!this.checkLoginStatus()) return;
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

  initializeDates() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    this.setData({
      startDate: this.formatDate(thirtyDaysAgo),
      endDate: this.formatDate(now)
    });
  },

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async loadStatistics() {
    this.setData({ loading: true });

    try {
      const userId = wx.getStorageSync('userId');
      const dateRange = {
        start: new Date(this.data.startDate),
        end: new Date(this.data.endDate)
      };

      // Load statistics from backend
      const statsData = await db.getStatistics(userId, dateRange);
      
      // Process and format the data
      const statistics = this.processStatistics(statsData);
      
      this.setData({
        statistics,
        loading: false
      });

    } catch (error) {
      console.error('Failed to load statistics:', error);
      wx.showToast({
        title: '加载统计数据失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
  },

  processStatistics(rawData: any) {
    // Process land block statistics
    const landBlockStats = rawData.landBlocks?.map((item: any) => {
      const maxRecords = Math.max(...rawData.landBlocks.map((lb: any) => lb.recordCount));
      return {
        ...item,
        percentage: maxRecords > 0 ? (item.recordCount / maxRecords) * 100 : 0
      };
    }) || [];

    // Process fertilizer statistics
    const fertilizerStats = rawData.fertilizers?.map((item: any) => {
      const maxAmount = Math.max(...rawData.fertilizers.map((f: any) => f.totalAmount));
      return {
        ...item,
        percentage: maxAmount > 0 ? (item.totalAmount / maxAmount) * 100 : 0
      };
    }) || [];

    // Process recent activity
    const recentActivity = rawData.recentActivity?.map((item: any) => ({
      ...item,
      date: this.formatActivityDate(new Date(item.createdAt))
    })) || [];

    // Generate AI insights
    const insights = this.generateInsights(rawData);

    return {
      totalRecords: rawData.totalRecords || 0,
      totalLandBlocks: rawData.totalLandBlocks || 0,
      totalImages: rawData.totalImages || 0,
      totalFertilizers: rawData.totalFertilizers || 0,
      landBlockStats,
      fertilizerStats,
      recentActivity,
      insights
    };
  },

  generateInsights(data: any): string[] {
    const insights: string[] = [];

    // Analysis based on data patterns
    if (data.totalRecords > 10) {
      insights.push('您的记录数据较为丰富，AI分析准确度较高');
    }

    if (data.landBlocks?.length > 3) {
      insights.push('多地块管理有助于提高农业生产效率');
    }

    if (data.fertilizers?.some((f: any) => f.totalAmount > 100)) {
      insights.push('注意合理控制肥料使用量，避免过度施肥');
    }

    if (data.recentActivity?.length > 5) {
      insights.push('记录频率较高，有助于及时掌握农作物状况');
    }

    // Seasonal insights
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 2 && currentMonth <= 4) {
      insights.push('春季是播种的好时节，建议增加土壤改良记录');
    } else if (currentMonth >= 5 && currentMonth <= 7) {
      insights.push('夏季需要重点关注病虫害防治和水分管理');
    } else if (currentMonth >= 8 && currentMonth <= 10) {
      insights.push('秋季收获期，建议记录产量和品质数据');
    } else {
      insights.push('冬季适合进行土地休整和来年规划');
    }

    return insights.length > 0 ? insights : ['暂无特别洞察，继续积累数据以获得更好的分析结果'];
  },

  formatActivityDate(date: Date): string {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return this.formatDate(date);
    }
  },

  onStartDateChange(e: any) {
    this.setData({
      startDate: e.detail.value
    });
    this.loadStatistics();
  },

  onEndDateChange(e: any) {
    this.setData({
      endDate: e.detail.value
    });
    this.loadStatistics();
  },

  selectLastWeek() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    this.setData({
      startDate: this.formatDate(weekAgo),
      endDate: this.formatDate(now)
    });
    this.loadStatistics();
  },

  selectLastMonth() {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    this.setData({
      startDate: this.formatDate(monthAgo),
      endDate: this.formatDate(now)
    });
    this.loadStatistics();
  },

  selectThisMonth() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    this.setData({
      startDate: this.formatDate(monthStart),
      endDate: this.formatDate(now)
    });
    this.loadStatistics();
  },

  exportData(e: any) {
    const type = e.currentTarget.dataset.type;
    
    wx.showToast({
      title: `导出${type.toUpperCase()}功能开发中`,
      icon: 'none'
    });

    // TODO: Implement export functionality
    // This would typically involve:
    // 1. Generating the export file on the backend
    // 2. Returning a download URL
    // 3. Using wx.downloadFile to download the file
    // 4. Using wx.openDocument to open the file
  },

  shareReport() {
    // Generate a shareable summary
    const summary = this.generateShareSummary();
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // For now, just copy to clipboard
    wx.setClipboardData({
      data: summary,
      success: () => {
        wx.showToast({
          title: '报告摘要已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  generateShareSummary(): string {
    const stats = this.data.statistics;
    return `农业管理统计报告\n` +
           `统计时间: ${this.data.startDate} 至 ${this.data.endDate}\n` +
           `总记录数: ${stats.totalRecords}\n` +
           `管理地块: ${stats.totalLandBlocks}个\n` +
           `肥料种类: ${stats.totalFertilizers}种\n` +
           `上传图片: ${stats.totalImages}张\n` +
           `生成时间: ${new Date().toLocaleString()}`;
  },

  onShareAppMessage() {
    return {
      title: '农业智能管理统计报告',
      desc: this.generateShareSummary(),
      path: '/pages/statistics/statistics'
    };
  }
});