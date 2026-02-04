import { useState, useEffect } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatCurrency } from '../../utils/currencyFormat';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  DollarSign,
  Users,
  Award,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  CreditCard,
  Smartphone,
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
    paymentPin: '',
  });
  const [paymentStatusModal, setPaymentStatusModal] = useState({
    open: false,
    trainerId: null,
    trainerName: '',
    currentStatus: 'draft',
    newStatus: 'paid',
  });
  const [copiedAccount, setCopiedAccount] = useState(null);
  const [copiedPin, setCopiedPin] = useState(null);
  const [mobilePage, setMobilePage] = useState(1); // Pagination for mobile cards

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

  // Reset mobile page when payrolls change
  useEffect(() => {
    setMobilePage(1);
  }, [payrollData?.payrolls]);

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
        payment_method: paymentModal.paymentMethod,
        payment_account_number: paymentModal.accountNumber,
        payment_pin: paymentModal.paymentPin || null,
      });
      
      setPaymentModal({ open: false, trainerId: null, trainerName: '', paymentMethod: '', accountNumber: '', paymentPin: '' });
      fetchPayrollData(); // Refresh data
    } catch (error) {
      console.error('Error saving payment method:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleMarkAsPaid = async (trainerId, trainerName, currentStatus) => {
    const isPaid = currentStatus !== 'paid';
    setPaymentStatusModal({
      open: true,
      trainerId: trainerId,
      trainerName: trainerName,
      currentStatus: currentStatus || 'draft',
      newStatus: isPaid ? 'paid' : 'draft',
    });
  };

  const confirmPaymentStatusChange = async () => {
    try {
      const { trainerId, newStatus } = paymentStatusModal;
      
      if (newStatus === 'paid') {
        // Mark as paid
        await api.post('/trainer-payroll/mark-paid', {
          trainer_id: trainerId,
          month: selectedMonth,
          year: selectedYear,
        });
      } else {
        // Mark as unpaid
        await api.put('/trainer-payroll/mark-unpaid', {
          trainer_id: trainerId,
          month: selectedMonth,
          year: selectedYear,
        });
      }
      
      // Close modal and refresh data
      setPaymentStatusModal({
        open: false,
        trainerId: null,
        trainerName: '',
        currentStatus: 'draft',
        newStatus: 'paid',
      });
      fetchPayrollData();
    } catch (error) {
      console.error('خطأ في تحديث حالة الدفع:', error);
      alert(`حدث خطأ أثناء تحديث حالة الدفع: ${error.response?.data?.message || error.message}`);
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

  const handleCopyPin = async (pin, trainerId) => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedPin(trainerId);
      setTimeout(() => {
        setCopiedPin(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = pin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPin(trainerId);
      setTimeout(() => {
        setCopiedPin(null);
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
      
      // تنسيق العملة
      const formatCurrencyForPDF = (amount) => {
        return new Intl.NumberFormat('ar-IQ', {
          style: 'currency',
          currency: 'IQD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount || 0);
      };
      
      // تنظيف اسم المدرب للملف
      const cleanFileName = (name) => {
        return name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
      };
      
      // إنشاء HTML
      const basePayFormatted = formatCurrencyForPDF(payroll.base_pay || 0);
      const renewalBonusFormatted = formatCurrencyForPDF(renewalBonus);
      const competitionBonusFormatted = formatCurrencyForPDF(competitionBonus);
      const volumeBonusFormatted = formatCurrencyForPDF(volumeBonus);
      const bonusDeductionFormatted = formatCurrencyForPDF(payroll.bonus_deduction || 0);
      const totalPayFormatted = formatCurrencyForPDF(payroll.total_pay || 0);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Cairo', Arial, sans-serif;
              padding: 20px;
              background: white;
              color: #1f2937;
              font-size: 14px;
            }
            .payroll-container {
              max-width: 100%;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #3b82f6;
            }
            .header h1 {
              font-size: 20px;
              color: #1f2937;
              margin-bottom: 8px;
              font-weight: 700;
            }
            .header h2 {
              font-size: 16px;
              color: #6b7280;
              font-weight: 600;
            }
            .header p {
              font-size: 12px;
              color: #6b7280;
              margin-top: 8px;
            }
            .info-section {
              margin-bottom: 18px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
              flex-wrap: wrap;
            }
            .info-label {
              font-weight: 600;
              color: #4b5563;
              font-size: 13px;
              flex: 1;
              min-width: 120px;
            }
            .info-value {
              font-weight: 700;
              color: #1f2937;
              font-size: 13px;
              text-align: left;
              flex: 1;
              min-width: 100px;
            }
            .bonuses-section {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 15px 0;
            }
            .bonuses-section h3 {
              font-size: 15px;
              margin-bottom: 12px;
              color: #1f2937;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 6px;
              font-weight: 700;
            }
            .bonus-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
              flex-wrap: wrap;
            }
            .bonus-item:last-child {
              border-bottom: none;
            }
            .bonus-item span:first-child {
              font-size: 12px;
              color: #4b5563;
              flex: 1;
              min-width: 100px;
            }
            .bonus-item span:last-child {
              font-size: 13px;
              font-weight: 700;
              color: #1f2937;
              text-align: left;
              flex: 1;
              min-width: 80px;
            }
            .total-section {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              padding: 18px;
              border-radius: 6px;
              text-align: center;
              margin-top: 20px;
            }
            .total-section .label {
              font-size: 14px;
              margin-bottom: 8px;
              font-weight: 600;
            }
            .total-section .amount {
              font-size: 24px;
              font-weight: 700;
            }
            .no-bonuses {
              text-align: center;
              color: #9ca3af;
              padding: 12px;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 10px;
              }
              .payroll-container {
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="payroll-container">
            <div class="header">
              <h1>كشف راتب المدرب</h1>
              <h2>${payroll.trainer_name || 'غير محدد'}</h2>
              <p>شهر ${monthName} ${selectedYear}</p>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">الراتب الأساسي:</span>
                <span class="info-value">${basePayFormatted}</span>
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
                  <span>${renewalBonusFormatted}</span>
                </div>
              ` : ''}
              ${payroll.include_competition_bonus ? `
                <div class="bonus-item">
                  <span>مكافأة المنافسة:</span>
                  <span>${competitionBonusFormatted}</span>
                </div>
              ` : ''}
              ${volumeBonus > 0 ? `
                <div class="bonus-item">
                  <span>مكافأة الكمية ${volumeBonus === 30000 || volumeBonus === '30000' ? '(60+)' : '(80+)'}:</span>
                  <span>${volumeBonusFormatted}</span>
                </div>
              ` : ''}
              ${totalBonuses === 0 ? '<div class="no-bonuses">لا توجد مكافآت</div>' : ''}
            </div>
            
            ${payroll.bonus_deduction && parseFloat(payroll.bonus_deduction) !== 0 ? `
              <div class="info-section" style="background: ${parseFloat(payroll.bonus_deduction) > 0 ? '#d1fae5' : '#fee2e2'}; padding: 12px; border-radius: 6px;">
                <div class="info-row" style="border: none;">
                  <span class="info-label">${parseFloat(payroll.bonus_deduction) > 0 ? 'بونص إضافي' : 'خصم'}:</span>
                  <span class="info-value" style="color: ${parseFloat(payroll.bonus_deduction) > 0 ? '#059669' : '#dc2626'};">
                    ${bonusDeductionFormatted}
                  </span>
                </div>
                ${payroll.bonus_deduction_notes ? `
                  <p style="margin-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">${payroll.bonus_deduction_notes.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                ` : ''}
              </div>
            ` : ''}
            
            <div class="total-section">
              <div class="label">الإجمالي المستحق</div>
              <div class="amount">${totalPayFormatted}</div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // إنشاء عنصر مخفي في الصفحة الحالية بدلاً من نافذة جديدة
      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.position = 'absolute';
      hiddenDiv.style.left = '-9999px';
      hiddenDiv.style.top = '-9999px';
      hiddenDiv.style.width = '100%';
      hiddenDiv.style.maxWidth = '600px';
      hiddenDiv.innerHTML = htmlContent;
      document.body.appendChild(hiddenDiv);
      
      // انتظار تحميل الخطوط
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        // استخدام html2canvas لالتقاط الصورة
        const canvas = await html2canvas(hiddenDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: hiddenDiv.scrollWidth,
          height: hiddenDiv.scrollHeight,
        });
        
        // تحويل Canvas إلى PDF
        const imgData = canvas.toDataURL('image/png', 1.0);
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
        const fileName = `راتب_${cleanFileName(payroll.trainer_name || 'غير_محدد')}_${monthName}_${selectedYear}.pdf`;
        pdf.save(fileName);
        
        // إزالة العنصر المخفي
        document.body.removeChild(hiddenDiv);
      } catch (error) {
        console.error('خطأ في تحويل الصورة:', error);
        // إزالة العنصر المخفي في حالة الخطأ
        if (document.body.contains(hiddenDiv)) {
          document.body.removeChild(hiddenDiv);
        }
        throw error;
      }
      
    } catch (error) {
      console.error('خطأ في تحميل صورة الراتب:', error);
      alert(`حدث خطأ أثناء تحميل صورة الراتب: ${error.message || 'خطأ غير معروف'}`);
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
          <h1 className="page-title text-base sm:text-2xl">رواتب المدربين</h1>
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
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="page-title flex items-center gap-1.5 sm:gap-2 text-base sm:text-2xl">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
            رواتب المدربين
          </h1>
          <p className="page-subtitle">
            عرض رواتب المدربين والبونصات الشهرية - {months[selectedMonth - 1]?.label} {selectedYear}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-sm text-blue-600 dark:text-blue-400 font-medium">التاريخ الحالي:</span>
              <span className="text-[10px] sm:text-sm font-bold text-blue-700 dark:text-blue-300 truncate">
                {new Date().toLocaleDateString('ar-IQ', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
          <div className="hidden sm:block h-6 w-px bg-blue-300 dark:bg-blue-700 mx-2"></div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
            <span className="text-[10px] sm:text-sm text-blue-600 dark:text-blue-400 font-medium">الفترة المحددة:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-2 sm:px-3 py-1 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 text-blue-700 dark:text-blue-300 font-medium text-[10px] sm:text-sm cursor-pointer appearance-none"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-2 sm:px-3 py-1 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 text-blue-700 dark:text-blue-300 font-medium text-[10px] sm:text-sm cursor-pointer appearance-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="card p-2 sm:p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1.5 sm:p-3 rounded-xl bg-emerald-500/20">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)]">إجمالي الرواتب</p>
              <p className="text-sm sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {formatCurrency(summary.total_payout)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-2 sm:p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1.5 sm:p-3 rounded-xl bg-blue-500/20">
              <Users className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)]">عدد المدربين</p>
              <p className="text-sm sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                {summary.total_trainers || payrolls.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-2 sm:p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1.5 sm:p-3 rounded-xl bg-purple-500/20">
              <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)]">إجمالي المحاضرات</p>
              <p className="text-sm sm:text-xl font-bold text-purple-600 dark:text-purple-400">
                {summary.total_lectures || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-2 sm:p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1.5 sm:p-3 rounded-xl bg-amber-500/20">
              <Repeat className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)]">إجمالي التجديدات</p>
              <p className="text-sm sm:text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary.total_renewals || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Competition Winners */}
      {competitionWinners.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-2.5 sm:p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-b border-amber-200 dark:border-amber-800">
            <h2 className="text-xs sm:text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
              <span className="truncate">الفائزون بمكافأة المنافسة</span>
              <span className="text-[10px] sm:text-sm font-normal text-[var(--color-text-muted)]">
                (أعلى 3 مدربين بالتجديدات)
              </span>
            </h2>
          </div>
          <div className="p-2.5 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
              {competitionWinners.map((winner, index) => (
                <div
                  key={winner.trainer_id}
                  className={`relative p-2.5 sm:p-4 rounded-xl border-2 ${
                    index === 0
                      ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-400'
                      : index === 1
                      ? 'bg-gradient-to-br from-slate-300/20 to-slate-400/10 border-slate-400'
                      : 'bg-gradient-to-br from-orange-400/20 to-orange-500/10 border-orange-400'
                  }`}
                >
                  <div className="absolute -top-2 sm:-top-3 -right-2 sm:-right-3">
                    <div
                      className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-start justify-start text-white font-bold shadow-lg p-1 sm:p-1.5 ${
                        index === 0
                          ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                          : index === 1
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gradient-to-br from-orange-400 to-orange-500'
                      }`}
                    >
                      <span className="text-[9px] sm:text-xs leading-none">{winner.rank}</span>
                    </div>
                  </div>
                  <div className="pt-1.5 sm:pt-2">
                    <h3 className="font-bold text-xs sm:text-lg text-[var(--color-text-primary)] truncate">
                      {winner.trainer_name}
                    </h3>
                    <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)] mt-0.5 sm:mt-1">
                      {winner.renewals_count} تجديد
                    </p>
                    <p className="text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 sm:mt-2">
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
          <div className="p-3 sm:p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xs sm:text-lg font-bold text-[var(--color-text-primary)] text-center whitespace-nowrap">
              تفاصيل رواتب المدربين - {months[selectedMonth - 1]?.label} {selectedYear}
            </h2>
          </div>
          {/* Mobile Cards View */}
          <div className="md:hidden">
            {/* Pagination Logic */}
            {(() => {
              const itemsPerPage = 5;
              const totalPages = Math.ceil(payrolls.length / itemsPerPage);
              const startIndex = (mobilePage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentPayrolls = payrolls.slice(startIndex, endIndex);
              
              return (
                <>
                  <div className="space-y-2 p-2">
                    {currentPayrolls.map((payroll, relativeIndex) => {
                      const index = startIndex + relativeIndex;
                      const volumeBonus = getVolumeBonus(payroll.completed_lectures);
                      const isWinner = isCompetitionWinner(payroll.trainer_id);
                      const rank = getWinnerRank(payroll.trainer_id);
                      
                      return (
                <div
                  key={payroll.trainer_id}
                  className={`p-2 rounded-lg border-2 max-w-full overflow-hidden ${
                    isWinner 
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-800 dark:text-white">{index + 1}</span>
                    </div>
                    
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPayrollImage(payroll);
                        }}
                        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-blue-500 hover:text-blue-600 transition-colors"
                        title="تحميل صورة الراتب"
                      >
                        <Receipt className="w-3 h-3" />
                      </button>
                      {isWinner && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium ${
                            rank === 1
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : rank === 2
                              ? 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          <Trophy className="w-2 h-2" />
                          {rank}
                        </span>
                      )}
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المدرب:</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate flex-1">{payroll.trainer_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المحاضرات:</span>
                      <span className="badge badge-info text-xs px-1 py-0.5">
                        {payroll.completed_lectures}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الراتب:</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white truncate" title={`${payroll.completed_lectures} محاضرة × 4,000 د.ع = ${formatCurrency(payroll.base_pay)}`}>
                        {formatCurrency(payroll.base_pay)}
                      </span>
                    </div>
                    
                    <div className="col-span-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">التحويل:</span>
                        {payroll.payment_method ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModal({
                                open: true,
                                trainerId: payroll.trainer_id,
                                trainerName: payroll.trainer_name,
                                paymentMethod: payroll.payment_method || '',
                                accountNumber: payroll.payment_account_number || '',
                                paymentPin: payroll.payment_pin || '',
                              });
                            }}
                            className={`px-1 py-0.5 rounded-md font-medium text-xs transition-all flex items-center gap-0.5 ${
                              payroll.payment_method === 'zain_cash'
                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {payroll.payment_method === 'zain_cash' ? (
                              <>
                                <Smartphone className="w-3 h-3" />
                                <span>زين</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-3 h-3" />
                                <span>كي كارد</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                      {payroll.payment_account_number && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">الرقم:</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAccountNumber(payroll.payment_account_number, payroll.trainer_id);
                            }}
                            className="flex items-center gap-0.5 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <span>{payroll.payment_account_number}</span>
                            {copiedAccount === payroll.trainer_id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                      {payroll.payment_pin && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">PIN:</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPin(payroll.payment_pin, payroll.trainer_id);
                            }}
                            className="flex items-center gap-0.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            <span>{payroll.payment_pin}</span>
                            {copiedPin === payroll.trainer_id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">التجديدات:</span>
                      <span className="text-sm text-gray-800 dark:text-white">{payroll.renewals_count || 0}</span>
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المكافآت:</span>
                      <div className="flex flex-wrap gap-0.5">
                        {payroll.include_renewal_bonus && (payroll.renewals_count > 0 || (payroll.renewal_total && payroll.renewal_total > 0)) && (
                          <span className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-500 rounded text-[10px]">
                            تجديد
                          </span>
                        )}
                        {payroll.include_volume_bonus && volumeBonus > 0 && (
                          <span className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-500 rounded text-[10px]">
                            كمية
                          </span>
                        )}
                        {isWinner && (
                          <span className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-500 rounded text-[10px]">
                            منافسة
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">بونص/خصم:</span>
                      <span className={`text-sm font-medium ${
                        (payroll.bonus_deduction || 0) >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(payroll.bonus_deduction || 0)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الإجمالي:</span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">{formatCurrency(payroll.total)}</span>
                    </div>
                    
                    <div className="col-span-2 flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">حالة الدفع:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPaymentStatusModal(
                            payroll.trainer_id,
                            payroll.trainer_name,
                            payroll.status
                          );
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all ${
                          payroll.status === 'paid'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {payroll.status === 'paid' ? '✓ تم الدفع' : 'مسودة'}
                      </button>
                    </div>
                  </div>
                </div>
              );
                    })}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button
                        onClick={() => setMobilePage(prev => Math.max(1, prev - 1))}
                        disabled={mobilePage === 1}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-[10px] sm:text-xs ${
                          mobilePage === 1
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        السابق
                      </button>

                      <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                        صفحة {mobilePage} من {totalPages}
                      </span>

                      <button
                        onClick={() => setMobilePage(prev => Math.min(totalPages, prev + 1))}
                        disabled={mobilePage === totalPages}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-[10px] sm:text-xs ${
                          mobilePage === totalPages
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        التالي
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
            <table className="table text-sm min-w-[1000px]">
              <thead>
                <tr>
                  <th className="text-xs py-2 px-2 text-center">#</th>
                  <th className="text-xs py-2 px-2 text-center">المدرب</th>
                  <th className="text-xs py-2 px-2 text-center">المحاضرات</th>
                  <th className="text-xs py-2 px-2 text-center">الراتب الأساسي</th>
                  <th className="text-xs py-2 px-2 text-center">طريقة التحويل</th>
                  <th className="text-xs py-2 px-2 text-center">التجديدات</th>
                  <th className="text-xs py-2 px-2 text-center">المكافآت</th>
                  <th className="text-xs py-2 px-2 text-center">بونص/خصم</th>
                  <th className="text-xs py-2 px-2 text-center">الإجمالي</th>
                  <th className="text-xs py-2 px-2 text-center">حالة الدفع</th>
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
                        // Don't expand if clicking on bonus/deduction or payment method
                        if (!e.target.closest('.bonus-deduction-cell') && 
                            !e.target.closest('.payment-method-cell')) {
                          setExpandedTrainer(
                            expandedTrainer === payroll.trainer_id ? null : payroll.trainer_id
                          );
                        }
                      }}
                    >
                      <td className="font-semibold py-2 px-2 text-xs text-center">{index + 1}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
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
                      <td className="py-2 px-2 text-center">
                        <span className="badge badge-info text-[10px] px-1.5 py-0.5">
                          {payroll.completed_lectures} محاضرة
                        </span>
                      </td>
                      <td className="font-medium py-2 px-2 text-xs text-center" title={`${payroll.completed_lectures} محاضرة × 4,000 د.ع = ${formatCurrency(payroll.base_pay)}`}>
                        {formatCurrency(payroll.base_pay)}
                      </td>
                      <td className="py-2 px-2 payment-method-cell text-center">
                        {payroll.payment_method ? (
                          <div className="flex flex-col gap-1.5 items-center">
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
                              className={`px-2 py-1 rounded-md font-medium text-[10px] transition-all hover:scale-105 w-fit flex items-center gap-1 ${
                                payroll.payment_method === 'zain_cash'
                                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}
                            >
                              {payroll.payment_method === 'zain_cash' ? (
                                <>
                                  <Smartphone className="w-3 h-3" />
                                  <span>زين كاش</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3 h-3" />
                                  <span>كي كارد</span>
                                </>
                              )}
                            </button>
                            {payroll.payment_account_number && (
                              <div className="flex flex-col gap-1.5 items-center">
                                <div className="relative group">
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium w-fit">
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
                                {payroll.payment_pin && (
                                  <div className="relative group">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[10px] font-medium w-fit border border-red-200 dark:border-red-800">
                                      <span>PIN: {payroll.payment_pin}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyPin(payroll.payment_pin, payroll.trainer_id);
                                        }}
                                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                        title="نسخ الرقم السري"
                                      >
                                        {copiedPin === payroll.trainer_id ? (
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
                                        اضغط لنسخ الرقم السري
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                      <td className="py-2 px-2 text-center">
                        <span className="badge badge-purple text-[10px] px-1.5 py-0.5">{payroll.renewals_count} تجديد</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {(() => {
                          const bonusNames = [];
                          // مكافأة التجديد: تظهر إذا كان include_renewal_bonus true و renewals_count > 0
                          if (payroll.include_renewal_bonus && (payroll.renewals_count > 0 || (payroll.renewal_total && payroll.renewal_total > 0))) {
                            bonusNames.push('التجديد');
                          }
                          // مكافأة الكمية: تظهر إذا كان include_volume_bonus true و volume_bonus > 0
                          if (payroll.include_volume_bonus && payroll.volume_bonus > 0) {
                            if (payroll.volume_bonus >= 80000) {
                              bonusNames.push('الكمية (80+)');
                            } else if (payroll.volume_bonus >= 30000) {
                              bonusNames.push('الكمية (60+)');
                            }
                          }
                          // مكافأة المنافسة: تظهر إذا كان include_competition_bonus true و competition_bonus > 0
                          if (payroll.include_competition_bonus && payroll.competition_bonus > 0) {
                            bonusNames.push('المنافسة');
                          }
                          
                          if (bonusNames.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1.5 items-center justify-center px-2 py-1">
                                {bonusNames.map((name, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-500 rounded-md px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return <span className="text-[var(--color-text-muted)] text-[10px]">-</span>;
                        })()}
                      </td>
                      <td className="bonus-deduction-cell py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
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
                      <td className="py-2 px-2 text-center">
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payroll.total_pay)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsPaid(payroll.trainer_id, payroll.trainer_name, payroll.status || 'draft');
                          }}
                          className={`px-3 py-1.5 rounded-md font-medium text-[10px] transition-all hover:scale-105 flex items-center gap-1.5 ${
                            (payroll.status || 'draft') === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          title={(payroll.status || 'draft') === 'paid' ? 'تم الدفع' : 'لم يتم الدفع'}
                        >
                          {(payroll.status || 'draft') === 'paid' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>تم الدفع</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>لم يدفع</span>
                            </>
                          )}
                        </button>
                        {payroll.paid_at && (
                          <p className="text-[9px] text-[var(--color-text-muted)] mt-1">
                            {new Date(payroll.paid_at).toLocaleDateString('ar-IQ', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
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
                  <td className="py-2 px-2"></td>
                  <td className="font-bold py-2 px-2 text-xs">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.bonus_deduction || 0), 0))}
                  </td>
                  <td className="font-bold text-base text-emerald-600 dark:text-emerald-400 py-2 px-2">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.total_pay || 0), 0))}
                  </td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Bonus Info */}
      <div className="card p-3 sm:p-6 max-w-full overflow-hidden">
        <h3 className="font-bold text-xs sm:text-lg text-[var(--color-text-primary)] mb-3 sm:mb-4 flex items-center justify-center gap-1.5 sm:gap-2">
          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
          <span className="text-center">نظام المكافآت والبونصات</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-2.5 sm:p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
              <span className="font-semibold text-[10px] sm:text-sm text-[var(--color-text-primary)]">سعر المحاضرة</span>
            </div>
            <p className="text-base sm:text-2xl font-bold text-blue-600 dark:text-blue-400">4,000 د.ع</p>
            <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)] mt-1">لكل محاضرة مكتملة</p>
          </div>

          <div className="p-2.5 sm:p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <Repeat className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
              <span className="font-semibold text-[10px] sm:text-sm text-[var(--color-text-primary)]">مكافأة التجديد</span>
            </div>
            <p className="text-base sm:text-2xl font-bold text-amber-600 dark:text-amber-400">5,000 د.ع</p>
            <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)] mt-1">لكل تجديد مع نفس المدرب</p>
          </div>

          <div className="p-2.5 sm:p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
              <span className="font-semibold text-[10px] sm:text-sm text-[var(--color-text-primary)]">مكافأة الكمية</span>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400">
                60+ = 30,000 د.ع
              </p>
              <p className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400">
                80+ = 80,000 د.ع
              </p>
            </div>
            <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)] mt-1">محاضرات شهرياً</p>
          </div>

          <div className="p-2.5 sm:p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0" />
              <span className="font-semibold text-[10px] sm:text-sm text-[var(--color-text-primary)]">مكافأة المنافسة</span>
            </div>
            <p className="text-base sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">20,000 د.ع</p>
            <p className="text-[10px] sm:text-sm text-[var(--color-text-muted)] mt-1">
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

              <div>
                <label className="label">الرقم السري (PIN)</label>
                <input
                  type="text"
                  value={paymentModal.paymentPin}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paymentPin: e.target.value })}
                  className="input"
                  placeholder="أدخل الرقم السري للبطاقة (اختياري)"
                  maxLength={20}
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  الرقم السري للبطاقة (Q كارد فقط)
                </p>
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

      {/* Payment Status Confirmation Modal */}
      {paymentStatusModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                تأكيد تغيير حالة الدفع
              </h3>
              <button
                onClick={() => setPaymentStatusModal({
                  open: false,
                  trainerId: null,
                  trainerName: '',
                  currentStatus: 'draft',
                  newStatus: 'paid',
                })}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">المدرب:</p>
                <p className="font-bold text-[var(--color-text-primary)]">{paymentStatusModal.trainerName}</p>
              </div>

              <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">الحالة الحالية:</p>
                <p className="font-bold text-[var(--color-text-primary)]">
                  {paymentStatusModal.currentStatus === 'paid' ? 'تم الدفع' : 'لم يتم الدفع'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">الحالة الجديدة:</p>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {paymentStatusModal.newStatus === 'paid' ? 'تم الدفع' : 'لم يتم الدفع'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  سيتم حفظ التغييرات وتسجيلها في سجل التعديلات
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setPaymentStatusModal({
                  open: false,
                  trainerId: null,
                  trainerName: '',
                  currentStatus: 'draft',
                  newStatus: 'paid',
                })}
                className="btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={confirmPaymentStatusChange}
                className={`btn-primary ${
                  paymentStatusModal.newStatus === 'paid'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                حفظ التغييرات
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

