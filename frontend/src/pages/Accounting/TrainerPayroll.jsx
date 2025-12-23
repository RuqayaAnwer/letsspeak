import { useState, useEffect } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  DollarSign,
  Users,
  Award,
  TrendingUp,
  Calendar,
  ChevronDown,
  Trophy,
  Repeat,
  BookOpen,
  Star,
  Plus,
  Minus,
  Info,
  X,
  Copy,
  Check,
  Receipt,
} from 'lucide-react';

const TrainerPayroll = () => {
  const [payrollData, setPayrollData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedTrainer, setExpandedTrainer] = useState(null);
  const [bonusModal, setBonusModal] = useState({
    open: false,
    trainerId: null,
    trainerName: '',
    bonusDeduction: '',
    notes: '',
  });
  const [notesModal, setNotesModal] = useState({
    open: false,
    notes: '',
  });
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    trainerId: null,
    trainerName: '',
    paymentMethod: '',
    accountNumber: '',
  });
  const [copiedAccount, setCopiedAccount] = useState(null);
  const [bonusSelectionModal, setBonusSelectionModal] = useState({
    open: false,
    trainerId: null,
    trainerName: '',
    includeRenewalBonus: false,
    includeCompetitionBonus: false,
    selectedVolumeBonus: null, // null, 'volume_60', or 'volume_80'
    renewalTotal: 0,
    competitionBonus: 0,
  });

  const months = [
    { value: 1, label: 'يناير' },
    { value: 2, label: 'فبراير' },
    { value: 3, label: 'مارس' },
    { value: 4, label: 'أبريل' },
    { value: 5, label: 'مايو' },
    { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' },
    { value: 8, label: 'أغسطس' },
    { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' },
    { value: 11, label: 'نوفمبر' },
    { value: 12, label: 'ديسمبر' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchPayrollData();
  }, [selectedMonth, selectedYear]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/trainer-payroll', {
        params: { month: selectedMonth, year: selectedYear },
      });
      
      console.log('Payroll API Response:', response.data);
      
      // Handle response structure
      if (response.data.success && response.data.data) {
        setPayrollData(response.data.data);
      } else       if (response.data.data) {
        const payrollsData = response.data.data.payrolls || response.data.data;
        console.log('Payrolls data received:', payrollsData);
        console.log('Sample payroll with volume bonus:', Array.isArray(payrollsData) ? payrollsData.find(p => p.selected_volume_bonus) : null);
        setPayrollData(response.data.data);
      } else if (response.data.payrolls) {
        const payrollsData = response.data.payrolls;
        console.log('Payrolls data received:', payrollsData);
        console.log('Sample payroll with volume bonus:', Array.isArray(payrollsData) ? payrollsData.find(p => p.selected_volume_bonus) : null);
        setPayrollData(response.data);
      } else {
        // Default empty data
        setPayrollData({
          month: selectedMonth,
          year: selectedYear,
          payrolls: [],
          competition_winners: [],
          summary: {
            total_trainers: 0,
            total_lectures: 0,
            total_renewals: 0,
            total_payout: 0,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching payroll data:', error);
      console.error('Error response:', error.response?.data);
      // إذا لم يكن الـ API موجوداً، نستخدم بيانات افتراضية
      setPayrollData({
        month: selectedMonth,
        year: selectedYear,
        payrolls: [],
        competition_winners: [],
        summary: {
          total_trainers: 0,
          total_lectures: 0,
          total_renewals: 0,
          total_payout: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US').format(amount || 0) + ' د.ع';
  };

  const getVolumeBonus = (lectures) => {
    if (lectures >= 80) return { amount: 80000, label: 'مكافأة 80 محاضرة' };
    if (lectures >= 60) return { amount: 30000, label: 'مكافأة 60 محاضرة' };
    return { amount: 0, label: '-' };
  };

  const isCompetitionWinner = (trainerId) => {
    return payrollData?.competition_winners?.some((w) => w.trainer_id === trainerId);
  };

  const getWinnerRank = (trainerId) => {
    const winner = payrollData?.competition_winners?.find((w) => w.trainer_id === trainerId);
    return winner?.rank || 0;
  };

  const handleSaveBonusDeduction = async () => {
    try {
      await api.put('/trainer-payroll/bonus-deduction', {
        trainer_id: bonusModal.trainerId,
        month: selectedMonth,
        year: selectedYear,
        bonus_deduction: parseFloat(bonusModal.bonusDeduction) || 0,
        bonus_deduction_notes: bonusModal.notes,
      });
      
      setBonusModal({ open: false, trainerId: null, trainerName: '', bonusDeduction: '', notes: '' });
      fetchPayrollData(); // Refresh data
    } catch (error) {
      console.error('Error saving bonus/deduction:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleSavePaymentMethod = async () => {
    try {
      await api.put('/trainer-payroll/payment-method', {
        trainer_id: paymentModal.trainerId,
        month: selectedMonth,
        year: selectedYear,
        payment_method: paymentModal.paymentMethod,
        payment_account_number: paymentModal.accountNumber,
      });
      
      setPaymentModal({ open: false, trainerId: null, trainerName: '', paymentMethod: '', accountNumber: '' });
      fetchPayrollData(); // Refresh data
    } catch (error) {
      console.error('Error saving payment method:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  // حساب مجموع المكافآت المختارة
  const calculateTotalBonus = (payroll) => {
    let total = 0;
    
    // مكافأة التجديد: إذا كانت مختارة، أضف 5000 (أو القيمة المحسوبة إذا كانت أكبر)
    if (payroll.include_renewal_bonus === true) {
      total += (payroll.renewal_total > 0) ? payroll.renewal_total : 5000;
    }
    
    // مكافأة المنافسة: إذا كانت مختارة، أضف 20000 (أو القيمة المحسوبة إذا كانت أكبر)
    if (payroll.include_competition_bonus === true) {
      total += (payroll.competition_bonus > 0) ? payroll.competition_bonus : 20000;
    }
    
    // مكافأة الكمية: إذا كانت مختارة، أضف القيمة (30000 أو 80000)
    if (payroll.selected_volume_bonus) {
      const volumeAmount = Number(payroll.selected_volume_bonus);
      if (volumeAmount > 0) {
        total += volumeAmount;
      }
    }
    
    return total;
  };

  const handleSaveBonusSelection = async () => {
    try {
      // تحديد قيمة مكافأة الكمية
      let volumeBonusValue = null;
      if (bonusSelectionModal.selectedVolumeBonus === 'volume_60') {
        volumeBonusValue = 30000;
      } else if (bonusSelectionModal.selectedVolumeBonus === 'volume_80') {
        volumeBonusValue = 80000;
      }
      
      const payload = {
        trainer_id: bonusSelectionModal.trainerId,
        month: selectedMonth,
        year: selectedYear,
        include_renewal_bonus: bonusSelectionModal.includeRenewalBonus,
        include_competition_bonus: bonusSelectionModal.includeCompetitionBonus,
        selected_volume_bonus: volumeBonusValue,
      };
      
      console.log('حفظ المكافآت:', payload);
      
      await api.put('/trainer-payroll/bonus-selection', payload);
      
      // إغلاق Modal
      setBonusSelectionModal({ 
        open: false, 
        trainerId: null, 
        trainerName: '', 
        includeRenewalBonus: false,
        includeCompetitionBonus: false,
        selectedVolumeBonus: null,
        renewalTotal: 0,
        competitionBonus: 0,
      });
      
      // إعادة تحميل البيانات
      fetchPayrollData();
    } catch (error) {
      console.error('خطأ في حفظ المكافآت:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCopyAccountNumber = async (accountNumber, trainerId) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(trainerId);
      setTimeout(() => {
        setCopiedAccount(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = accountNumber;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedAccount(trainerId);
      setTimeout(() => {
        setCopiedAccount(null);
      }, 2000);
    }
  };

  const handleDownloadPayrollImage = async (payroll) => {
    try {
      // إنشاء HTML للراتب
      const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      
      const monthName = monthNames[selectedMonth - 1];
      
      // حساب المكافآت
      const renewalBonus = (payroll.include_renewal_bonus && (payroll.renewal_total || 0) > 0)
        ? payroll.renewal_total
        : (payroll.include_renewal_bonus ? 5000 : 0);
      
      const competitionBonus = (payroll.include_competition_bonus && (payroll.competition_bonus || 0) > 0)
        ? payroll.competition_bonus
        : (payroll.include_competition_bonus ? 20000 : 0);
      
      const volumeBonus = parseFloat(payroll.selected_volume_bonus) || 0;
      
      const totalBonuses = renewalBonus + competitionBonus + volumeBonus;
      
      // إنشاء HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Cairo', Arial, sans-serif;
              padding: 40px;
              background: white;
              color: #1f2937;
            }
            .payroll-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #3b82f6;
            }
            .header h1 {
              font-size: 28px;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .header h2 {
              font-size: 20px;
              color: #6b7280;
              font-weight: 500;
            }
            .info-section {
              margin-bottom: 25px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-label {
              font-weight: 600;
              color: #4b5563;
            }
            .info-value {
              font-weight: 700;
              color: #1f2937;
            }
            .bonuses-section {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .bonuses-section h3 {
              font-size: 18px;
              margin-bottom: 15px;
              color: #1f2937;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 8px;
            }
            .bonus-item {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .bonus-item:last-child {
              border-bottom: none;
            }
            .total-section {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              padding: 25px;
              border-radius: 8px;
              text-align: center;
              margin-top: 25px;
            }
            .total-section .label {
              font-size: 16px;
              margin-bottom: 10px;
            }
            .total-section .amount {
              font-size: 32px;
              font-weight: 700;
            }
            .no-bonuses {
              text-align: center;
              color: #9ca3af;
              padding: 15px;
            }
          </style>
        </head>
        <body>
          <div class="payroll-container">
            <div class="header">
              <h1>كشف راتب المدرب</h1>
              <h2>${payroll.trainer_name}</h2>
              <p style="margin-top: 10px; color: #6b7280;">شهر ${monthName} ${selectedYear}</p>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">الراتب الأساسي:</span>
                <span class="info-value">${formatCurrency(payroll.base_pay || 0)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">عدد المحاضرات المكتملة:</span>
                <span class="info-value">${payroll.completed_lectures || 0} محاضرة</span>
              </div>
            </div>
            
            <div class="bonuses-section">
              <h3>المكافآت</h3>
              ${payroll.include_renewal_bonus ? `
                <div class="bonus-item">
                  <span>مكافأة التجديد:</span>
                  <span>${formatCurrency(renewalBonus)}</span>
                </div>
              ` : ''}
              ${payroll.include_competition_bonus ? `
                <div class="bonus-item">
                  <span>مكافأة المنافسة:</span>
                  <span>${formatCurrency(competitionBonus)}</span>
                </div>
              ` : ''}
              ${volumeBonus > 0 ? `
                <div class="bonus-item">
                  <span>مكافأة الكمية ${volumeBonus === 30000 || volumeBonus === '30000' ? '(60+)' : '(80+)'}:</span>
                  <span>${formatCurrency(volumeBonus)}</span>
                </div>
              ` : ''}
              ${totalBonuses === 0 ? '<div class="no-bonuses">لا توجد مكافآت</div>' : ''}
            </div>
            
            ${payroll.bonus_deduction && parseFloat(payroll.bonus_deduction) !== 0 ? `
              <div class="info-section" style="background: ${parseFloat(payroll.bonus_deduction) > 0 ? '#d1fae5' : '#fee2e2'}; padding: 15px; border-radius: 8px;">
                <div class="info-row" style="border: none;">
                  <span class="info-label">${parseFloat(payroll.bonus_deduction) > 0 ? 'بونص إضافي' : 'خصم'}:</span>
                  <span class="info-value" style="color: ${parseFloat(payroll.bonus_deduction) > 0 ? '#059669' : '#dc2626'};">
                    ${formatCurrency(payroll.bonus_deduction)}
                  </span>
                </div>
                ${payroll.bonus_deduction_notes ? `
                  <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">${payroll.bonus_deduction_notes}</p>
                ` : ''}
              </div>
            ` : ''}
            
            <div class="total-section">
              <div class="label">الإجمالي المستحق</div>
              <div class="amount">${formatCurrency(payroll.total_pay || 0)}</div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // إنشاء نافذة جديدة وعرض HTML
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // انتظار تحميل الصور والخطوط
      setTimeout(async () => {
        try {
          // استخدام html2canvas لالتقاط الصورة
          const canvas = await html2canvas(printWindow.document.body, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
          
          // تحويل Canvas إلى PDF
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgWidth = 210;
          const pageHeight = 297;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;
          
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          
          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
          
          // تحميل PDF
          const fileName = `راتب_${payroll.trainer_name}_${monthName}_${selectedYear}.pdf`;
          pdf.save(fileName);
          
          // إغلاق النافذة
          printWindow.close();
        } catch (error) {
          console.error('خطأ في تحويل الصورة:', error);
          // في حالة الفشل، استخدم الطباعة العادية
          printWindow.print();
        }
      }, 1000);
      
    } catch (error) {
      console.error('خطأ في تحميل صورة الراتب:', error);
      alert('حدث خطأ أثناء تحميل صورة الراتب');
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  // Ensure payrollData is initialized
  if (!payrollData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">رواتب المدربين</h1>
        </div>
        <div className="card p-8 text-center">
          <p className="text-[var(--color-text-muted)]">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const payrolls = payrollData?.payrolls || [];
  const summary = payrollData?.summary || {};
  const competitionWinners = payrollData?.competition_winners || [];
  
  console.log('Payroll Data:', payrollData);
  console.log('Payrolls:', payrolls);
  console.log('Summary:', summary);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            رواتب المدربين
          </h1>
          <p className="page-subtitle">عرض رواتب المدربين والبونصات الشهرية</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="input-field pl-10 pr-4 appearance-none cursor-pointer"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field pl-10 pr-4 appearance-none cursor-pointer"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي الرواتب</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.total_payout)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">عدد المدربين</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {summary.total_trainers || payrolls.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي المحاضرات</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {summary.total_lectures || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <Repeat className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي التجديدات</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary.total_renewals || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Competition Winners */}
      {competitionWinners.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-b border-amber-200 dark:border-amber-800">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              الفائزون بمكافأة المنافسة
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                (أعلى 3 مدربين بالتجديدات)
              </span>
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {competitionWinners.map((winner, index) => (
                <div
                  key={winner.trainer_id}
                  className={`relative p-4 rounded-xl border-2 ${
                    index === 0
                      ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-400'
                      : index === 1
                      ? 'bg-gradient-to-br from-slate-300/20 to-slate-400/10 border-slate-400'
                      : 'bg-gradient-to-br from-orange-400/20 to-orange-500/10 border-orange-400'
                  }`}
                >
                  <div className="absolute -top-3 -right-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                        index === 0
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                          : index === 1
                          ? 'bg-gradient-to-br from-slate-400 to-slate-500'
                          : 'bg-gradient-to-br from-orange-400 to-orange-500'
                      }`}
                    >
                      {winner.rank}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                      {winner.trainer_name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {winner.renewals_count} تجديد
                    </p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      +{formatCurrency(winner.bonus)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      {payrolls.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات رواتب"
          description={`لا توجد بيانات رواتب لشهر ${months[selectedMonth - 1]?.label} ${selectedYear}`}
          icon={DollarSign}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              تفاصيل رواتب المدربين
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th className="text-xs py-2 px-2">#</th>
                  <th className="text-xs py-2 px-2">المدرب</th>
                  <th className="text-xs py-2 px-2">المحاضرات</th>
                  <th className="text-xs py-2 px-2">الراتب الأساسي</th>
                  <th className="text-xs py-2 px-2">طريقة التحويل</th>
                  <th className="text-xs py-2 px-2">التجديدات</th>
                  <th className="text-xs py-2 px-2">مكافأة</th>
                  <th className="text-xs py-2 px-2">بونص/خصم</th>
                  <th className="text-xs py-2 px-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((payroll, index) => {
                  const volumeBonus = getVolumeBonus(payroll.completed_lectures);
                  const isWinner = isCompetitionWinner(payroll.trainer_id);
                  const rank = getWinnerRank(payroll.trainer_id);

                  return (
                    <tr
                      key={payroll.trainer_id}
                      className={`cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                        isWinner ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                      }`}
                      onClick={(e) => {
                        // Don't expand if clicking on bonus/deduction, payment method, or bonus buttons
                        if (!e.target.closest('.bonus-deduction-cell') && 
                            !e.target.closest('.payment-method-cell') && 
                            !e.target.closest('.bonus-cell')) {
                          setExpandedTrainer(
                            expandedTrainer === payroll.trainer_id ? null : payroll.trainer_id
                          );
                        }
                      }}
                    >
                      <td className="font-semibold py-2 px-2 text-xs">{index + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPayrollImage(payroll);
                            }}
                            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-blue-500 hover:text-blue-600 transition-colors"
                            title="تحميل صورة الراتب"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-semibold text-[var(--color-text-primary)] text-xs">
                            {payroll.trainer_name}
                          </span>
                          {isWinner && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                rank === 1
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : rank === 2
                                  ? 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
                                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}
                            >
                              <Trophy className="w-2.5 h-2.5" />
                              المركز {rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="badge badge-info text-[10px] px-1.5 py-0.5">
                          {payroll.completed_lectures} محاضرة
                        </span>
                      </td>
                      <td className="font-medium py-2 px-2 text-xs">{formatCurrency(payroll.base_pay)}</td>
                      <td className="py-2 px-2 payment-method-cell">
                        {payroll.payment_method ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentModal({
                                  open: true,
                                  trainerId: payroll.trainer_id,
                                  trainerName: payroll.trainer_name,
                                  paymentMethod: payroll.payment_method || '',
                                  accountNumber: payroll.payment_account_number || '',
                                });
                              }}
                              className="px-2 py-1 rounded-md font-medium text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 transition-all hover:scale-105"
                            >
                              {payroll.payment_method === 'zain_cash' ? 'زين كاش' : 'كي كارد'}
                            </button>
                            {payroll.payment_account_number && (
                              <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium">
                                  <span>{payroll.payment_account_number}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyAccountNumber(payroll.payment_account_number, payroll.trainer_id);
                                    }}
                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    title="نسخ الرقم"
                                  >
                                    {copiedAccount === payroll.trainer_id ? (
                                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                                  <div className="bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded-md py-1 px-2 shadow-lg whitespace-nowrap">
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
                                    اضغط لنسخ الرقم
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModal({
                                open: true,
                                trainerId: payroll.trainer_id,
                                trainerName: payroll.trainer_name,
                                paymentMethod: '',
                                accountNumber: '',
                              });
                            }}
                            className="px-2 py-1 rounded-md font-medium text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all hover:scale-105"
                          >
                            إضافة
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <span className="badge badge-purple text-[10px] px-1.5 py-0.5">{payroll.renewals_count} تجديد</span>
                      </td>
                      <td className="py-2 px-2 bonus-cell">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // تحديد المكافآت المختارة حالياً
                            let includeRenewal = payroll.include_renewal_bonus === true;
                            let includeCompetition = payroll.include_competition_bonus === true;
                            let selectedVolume = null;
                            
                            // تحديد مكافأة الكمية
                            if (payroll.selected_volume_bonus === 80000) {
                              selectedVolume = 'volume_80';
                            } else if (payroll.selected_volume_bonus === 30000) {
                              selectedVolume = 'volume_60';
                            }
                            
                            setBonusSelectionModal({
                              open: true,
                              trainerId: payroll.trainer_id,
                              trainerName: payroll.trainer_name,
                              includeRenewalBonus: includeRenewal,
                              includeCompetitionBonus: includeCompetition,
                              selectedVolumeBonus: selectedVolume,
                              renewalTotal: payroll.renewal_total || 0,
                              competitionBonus: payroll.competition_bonus || 0,
                            });
                          }}
                          className={`px-2 py-1 rounded-md font-medium text-[10px] transition-all hover:scale-105 ${
                            calculateTotalBonus(payroll) > 0
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {(() => {
                            const bonus = calculateTotalBonus(payroll);
                            return bonus > 0 ? `+${formatCurrency(bonus)}` : 'إضافة';
                          })()}
                        </button>
                      </td>
                      <td className="bonus-deduction-cell py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setBonusModal({
                                open: true,
                                trainerId: payroll.trainer_id,
                                trainerName: payroll.trainer_name,
                                bonusDeduction: payroll.bonus_deduction || '',
                                notes: payroll.bonus_deduction_notes || '',
                              });
                            }}
                            className={`px-2 py-1 rounded-md font-medium text-[10px] transition-all hover:scale-105 ${
                              payroll.bonus_deduction && payroll.bonus_deduction !== 0
                                ? payroll.bonus_deduction > 0
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {payroll.bonus_deduction && payroll.bonus_deduction !== 0
                              ? payroll.bonus_deduction > 0
                                ? `+${formatCurrency(payroll.bonus_deduction)}`
                                : formatCurrency(payroll.bonus_deduction)
                              : 'إضافة'}
                          </button>
                          {payroll.bonus_deduction_notes && (
                            <div className="relative group">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBonusModal({
                                    open: true,
                                    trainerId: payroll.trainer_id,
                                    trainerName: payroll.trainer_name,
                                    bonusDeduction: payroll.bonus_deduction || '',
                                    notes: payroll.bonus_deduction_notes || '',
                                  });
                                }}
                                className="p-1 rounded-md hover:bg-[var(--color-bg-tertiary)] text-blue-500 hover:text-blue-600 transition-colors"
                              >
                                <Info className="w-3 h-3" />
                              </button>
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg py-2 px-3 shadow-xl max-w-xs whitespace-pre-wrap break-words">
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                                  {payroll.bonus_deduction_notes}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payroll.total_pay)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[var(--color-bg-tertiary)]">
                <tr>
                  <td colSpan="3" className="font-bold text-[var(--color-text-primary)] py-2 px-2 text-xs">
                    الإجمالي
                  </td>
                  <td className="font-bold py-2 px-2 text-xs">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.base_pay || 0), 0))}
                  </td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2"></td>
                  <td className="font-bold text-purple-600 dark:text-purple-400 py-2 px-2 text-xs">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + calculateTotalBonus(p), 0))}
                  </td>
                  <td className="font-bold py-2 px-2 text-xs">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.bonus_deduction || 0), 0))}
                  </td>
                  <td className="font-bold text-base text-emerald-600 dark:text-emerald-400 py-2 px-2">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.total_pay || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Bonus Info */}
      <div className="card p-6">
        <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary-500" />
          نظام المكافآت والبونصات
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">سعر المحاضرة</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">4,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">لكل محاضرة مكتملة</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة التجديد</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">5,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">لكل تجديد مع نفس المدرب</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة الكمية</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                60+ = 30,000 د.ع
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                80+ = 80,000 د.ع
              </p>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">محاضرات شهرياً</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة المنافسة</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">20,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              لأفضل 3 مدربين بالتجديدات
            </p>
          </div>
        </div>
      </div>

      {/* Bonus/Deduction Modal */}
      {bonusModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                بونص/خصم - {bonusModal.trainerName}
              </h3>
              <button
                onClick={() => setBonusModal({ open: false, trainerId: null, trainerName: '', bonusDeduction: '', notes: '' })}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">المبلغ (د.ع) *</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  أدخل رقم موجب للبونص أو رقم سالب للخصم
                </p>
                <input
                  type="number"
                  value={bonusModal.bonusDeduction}
                  onChange={(e) => setBonusModal({ ...bonusModal, bonusDeduction: e.target.value })}
                  className="input"
                  placeholder="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="label">الملاحظة</label>
                <textarea
                  value={bonusModal.notes}
                  onChange={(e) => setBonusModal({ ...bonusModal, notes: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="اكتب سبب البونص أو الخصم..."
                  maxLength={1000}
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {bonusModal.notes.length}/1000
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setBonusModal({ open: false, trainerId: null, trainerName: '', bonusDeduction: '', notes: '' })}
                className="btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveBonusDeduction}
                className="btn-primary"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                طريقة التحويل - {paymentModal.trainerName}
              </h3>
              <button
                onClick={() => setPaymentModal({ open: false, trainerId: null, trainerName: '', paymentMethod: '', accountNumber: '' })}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">طريقة التحويل *</label>
                <select
                  value={paymentModal.paymentMethod}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">اختر طريقة التحويل</option>
                  <option value="zain_cash">زين كاش</option>
                  <option value="qi_card">كي كارد</option>
                </select>
              </div>

              <div>
                <label className="label">رقم البطاقة/الحساب *</label>
                <input
                  type="text"
                  value={paymentModal.accountNumber}
                  onChange={(e) => setPaymentModal({ ...paymentModal, accountNumber: e.target.value })}
                  className="input"
                  placeholder="أدخل رقم البطاقة أو الحساب"
                  maxLength={50}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setPaymentModal({ open: false, trainerId: null, trainerName: '', paymentMethod: '', accountNumber: '' })}
                className="btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={handleSavePaymentMethod}
                className="btn-primary"
                disabled={!paymentModal.paymentMethod || !paymentModal.accountNumber}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Selection Modal */}
      {bonusSelectionModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                اختيار المكافأة - {bonusSelectionModal.trainerName}
              </h3>
              <button
                onClick={() => setBonusSelectionModal({ 
                  open: false, 
                  trainerId: null, 
                  trainerName: '', 
                  includeRenewalBonus: false,
                  includeCompetitionBonus: false,
                  selectedVolumeBonus: null,
                  renewalTotal: 0,
                  competitionBonus: 0,
                })}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                يمكنك اختيار أكثر من مكافأة (التجديد والمنافسة)، لكن مكافأة الكمية يجب أن تكون واحدة فقط:
              </p>

              {/* Renewal Bonus - Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors">
                <input
                  type="checkbox"
                  checked={bonusSelectionModal.includeRenewalBonus}
                  onChange={(e) => {
                    e.stopPropagation();
                    setBonusSelectionModal({ 
                      ...bonusSelectionModal, 
                      includeRenewalBonus: e.target.checked
                    });
                  }}
                  className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)] text-sm block">
                      مكافأة التجديد
                    </span>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      5,000 د.ع لكل تجديد
                      {bonusSelectionModal.renewalTotal > 0 && (
                        <span className="block mt-0.5">
                          ({Math.round(bonusSelectionModal.renewalTotal / 5000)} تجديد × 5,000 = {formatCurrency(bonusSelectionModal.renewalTotal)})
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                    {formatCurrency(bonusSelectionModal.renewalTotal > 0 ? bonusSelectionModal.renewalTotal : 5000)}
                  </span>
                </div>
              </label>

              {/* Competition Bonus - Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors">
                <input
                  type="checkbox"
                  checked={bonusSelectionModal.includeCompetitionBonus}
                  onChange={(e) => {
                    e.stopPropagation();
                    setBonusSelectionModal({ 
                      ...bonusSelectionModal, 
                      includeCompetitionBonus: e.target.checked
                    });
                  }}
                  className="w-5 h-5 rounded text-yellow-600 focus:ring-yellow-500"
                />
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)] text-sm block">
                      مكافأة المنافسة
                    </span>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      20,000 د.ع لأفضل 3 مدربين
                      {bonusSelectionModal.competitionBonus > 0 && (
                        <span className="block mt-0.5 text-green-600 dark:text-green-400">
                          (المدرب ضمن أفضل 3)
                        </span>
                      )}
                      {bonusSelectionModal.competitionBonus === 0 && (
                        <span className="block mt-0.5 text-gray-500">
                          (المدرب ليس ضمن أفضل 3)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold text-sm">
                    {formatCurrency(bonusSelectionModal.competitionBonus > 0 ? bonusSelectionModal.competitionBonus : 20000)}
                  </span>
                </div>
              </label>

              {/* Volume Bonus Section */}
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-3 font-semibold">
                  مكافأة الكمية (اختر واحدة فقط):
                </p>
                <div className="space-y-2">
                  {/* No Volume Bonus */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <input
                      type="radio"
                      name="volume_bonus"
                      checked={bonusSelectionModal.selectedVolumeBonus === null}
                      onChange={(e) => {
                        e.stopPropagation();
                        setBonusSelectionModal({ 
                          ...bonusSelectionModal, 
                          selectedVolumeBonus: null
                        });
                      }}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-[var(--color-text-primary)]">لا يوجد</span>
                  </label>
                  
                  {/* Volume Bonus 60+ */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <input
                      type="radio"
                      name="volume_bonus"
                      checked={bonusSelectionModal.selectedVolumeBonus === 'volume_60'}
                      onChange={(e) => {
                        e.stopPropagation();
                        setBonusSelectionModal({ 
                          ...bonusSelectionModal, 
                          selectedVolumeBonus: 'volume_60'
                        });
                      }}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-primary)]">60+ محاضرة</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">
                        30,000 د.ع
                      </span>
                    </div>
                  </label>
                  
                  {/* Volume Bonus 80+ */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <input
                      type="radio"
                      name="volume_bonus"
                      checked={bonusSelectionModal.selectedVolumeBonus === 'volume_80'}
                      onChange={(e) => {
                        e.stopPropagation();
                        setBonusSelectionModal({ 
                          ...bonusSelectionModal, 
                          selectedVolumeBonus: 'volume_80'
                        });
                      }}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-primary)]">80+ محاضرة</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">
                        80,000 د.ع
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Total */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-2 border-purple-300 dark:border-purple-700 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg text-[var(--color-text-primary)]">
                    المكافأة المختارة:
                  </span>
                  <span className="font-bold text-xl text-purple-600 dark:text-purple-400">
                    {(() => {
                      let selectedAmount = 0;
                      
                      // مكافأة التجديد
                      if (bonusSelectionModal.includeRenewalBonus) {
                        selectedAmount += (bonusSelectionModal.renewalTotal > 0) ? bonusSelectionModal.renewalTotal : 5000;
                      }
                      
                      // مكافأة المنافسة
                      if (bonusSelectionModal.includeCompetitionBonus) {
                        selectedAmount += (bonusSelectionModal.competitionBonus > 0) ? bonusSelectionModal.competitionBonus : 20000;
                      }
                      
                      // مكافأة الكمية
                      if (bonusSelectionModal.selectedVolumeBonus === 'volume_60') {
                        selectedAmount += 30000;
                      } else if (bonusSelectionModal.selectedVolumeBonus === 'volume_80') {
                        selectedAmount += 80000;
                      }
                      
                      return formatCurrency(selectedAmount);
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setBonusSelectionModal({ 
                  open: false, 
                  trainerId: null, 
                  trainerName: '', 
                  includeRenewalBonus: false,
                  includeCompetitionBonus: false,
                  selectedVolumeBonus: null,
                  renewalTotal: 0,
                  competitionBonus: 0,
                })}
                className="btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveBonusSelection}
                className="btn-primary"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                الملاحظة
              </h3>
              <button
                onClick={() => setNotesModal({ open: false, notes: '' })}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
              <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">
                {notesModal.notes}
              </p>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setNotesModal({ open: false, notes: '' })}
                className="btn-primary"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TrainerPayroll;

