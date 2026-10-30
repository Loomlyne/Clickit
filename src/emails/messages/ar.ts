// Email strings, Arabic (Phase 5, plan 05-07; UI-SPEC 7.3). All Arabic text is a
// draft for Koss's review. The brand name stays Latin "Clickit Story" in emails
// (as in the signed Q12 picture and the sender name). Digits stay Western.
import { FOOTER_LINE_1, POSTAL_LINE } from '../brand.ts'
import type { EmailMessages } from './en.ts'

export const ar: EmailMessages = {
  e1: {
    subject: 'رمز الدخول إلى Clickit Story',
    preheader: 'الرمز صالح لمدة 15 دقيقة.',
    heading: 'رمز الدخول',
    body: 'أدخل هذا الرمز في Clickit Story. صالح لمدة 15 دقيقة.',
    fineprint:
      'لم تطلب الرمز؟ تجاهل هذه الرسالة، فلا يمكن لأحد الدخول بدون الرمز.',
  },
  e2: {
    subject: 'أكّد بريدك في Clickit Story',
    preheader: 'الزر والرمز صالحان لمدة 15 دقيقة.',
    heading: 'أكّد بريدك الإلكتروني',
    body: 'اضغط الزر لتأكيد بريدك، أو أدخل الرمز أدناه في Clickit Story. كلاهما صالح لمدة 15 دقيقة.',
    button: 'تأكيد البريد',
    fineprint: 'لم تنشئ حساباً؟ تجاهل هذه الرسالة.',
  },
  e3: {
    subject: 'إعادة تعيين كلمة مرور Clickit Story',
    preheader: 'الرابط صالح لمدة 15 دقيقة.',
    heading: 'إعادة تعيين كلمة المرور',
    body: 'اضغط الزر لاختيار كلمة مرور جديدة. الرابط صالح لمدة 15 دقيقة ويعمل من أي جهاز.',
    button: 'اختيار كلمة مرور جديدة',
    fineprint: 'لم تطلب ذلك؟ تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.',
  },
  e4: {
    subject: 'أكّد بريدك الجديد في Clickit Story',
    preheader: 'يجب تأكيد العنوانين.',
    heading: 'أكّد بريدك الجديد',
    body: 'طلبت تغيير بريدك في Clickit Story من {{ .Email }} إلى {{ .NewEmail }}. اضغط الزر للتأكيد. أرسلنا رابطاً آخر إلى العنوان الثاني، ويجب تأكيد الرابطين.',
    button: 'تأكيد البريد الجديد',
    fineprint: 'لم تطلب ذلك؟ تجاهل هذه الرسالة وسيبقى بريدك كما هو.',
  },
  e5: {
    subject: 'رمز الأمان في Clickit Story: {{ .Token }}',
    preheader: 'الرمز صالح لمدة 15 دقيقة.',
    heading: 'تأكّد أنه أنت',
    body: 'أدخل هذا الرمز لتأكيد تغيير كلمة المرور. صالح لمدة 15 دقيقة.',
    fineprint:
      'لم تطلب الرمز؟ قد يكون أحدهم يعرف كلمة مرورك. سجّل الدخول وغيّرها الآن.',
  },
  e6: {
    subject: 'أهلاً بك في Clickit Story',
    preheader: 'حسابك جاهز.',
    heading: 'أهلاً بك في Clickit Story',
    body: 'حسابك جاهز. اختر برنامجاً واضغط تشغيل، وسنتذكّر أين توقفت.',
    button: 'ابدأ المشاهدة',
  },
  e7: {
    subject: 'جديد في قائمتك على Clickit Story',
    preheader: 'حلقات جديدة جاهزة من قائمتك.',
    heading: 'جديد في قائمتك',
    body: 'حلقات جديدة جاهزة من البرامج في قائمتك.',
    watchEpisode: 'شاهد الحلقة',
    seeAll: 'شاهد الكل على Clickit Story',
    episodeLine: 'الموسم {season} الحلقة {episode} - {title}',
  },
  e8: {
    subject: 'وصلتنا رسالتك',
    preheader: 'نردّ عبر البريد الإلكتروني.',
    heading: 'وصلتنا رسالتك',
    body: 'شكراً لتواصلك مع Clickit Story. نردّ عبر البريد الإلكتروني خلال {hours} ساعة. هذه رسالة تلقائية ولا حاجة للرد عليها.',
  },
  e9: {
    subject: '[Clickit support] {subject}',
    preheader: 'رسالة جديدة من {name}.',
    heading: 'رسالة دعم جديدة',
    body: 'اضغط «رد» للرد على {name} مباشرة.',
    button: 'افتح في لوحة الإدارة',
    from: 'من',
    email: 'البريد',
    subjectLabel: 'الموضوع',
    replyHint: 'اضغط «رد» للرد على {name} مباشرة.',
  },
  e10: {
    subject: 'أكّد اشتراكك في نشرة Clickit Story',
    preheader: 'الرابط صالح لمدة {days} أيام.',
    heading: 'أكّد اشتراكك',
    body: 'اضغط الزر لتأكيد رغبتك في تلقي أخبار Clickit Story على بريدك. الرابط صالح لمدة {days} أيام.',
    button: 'تأكيد الاشتراك',
    fineprint: 'لم تشترك؟ تجاهل هذه الرسالة ولن يتم اشتراكك.',
  },
  footer: {
    line1: FOOTER_LINE_1,
    help: 'المساعدة:',
    helpLink: 'clickitstory.ae/support',
    unsubscribe: 'إلغاء الاشتراك',
    manage: 'إدارة الرسائل من ملفك الشخصي',
    digestReason: 'تصلك هذه الرسالة لأن برنامجاً في قائمتك أضاف حلقات جديدة.',
    postalLine: POSTAL_LINE,
  },
  fallbackUrl: 'أو افتح:',
  logoAlt: 'Clickit Story',
}
