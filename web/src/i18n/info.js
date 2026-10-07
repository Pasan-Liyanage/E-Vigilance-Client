/**
 * Copy for the public info page in English, Sinhala and Tamil.
 * Every language must define the same keys; English is the default.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
];

export const DEFAULT_LANG = 'en';

export const INFO_COPY = {
  en: {
    pageTitle: 'E-Vigilance - Report Traffic Violations',
    languageLabel: 'Language',
    eyebrow: 'E-Vigilance Public Vigilance Service',
    // The headline is two lines; the second is highlighted.
    title: ["Let's be careful,", "let's reduce accidents!"],
    law: 'Under the Motor Traffic Act No. 14 of 1951, breaking road rules and reckless driving are punishable offences.',
    subtitle:
      'The law is the same for everyone. Report dangerous driving and traffic violations you see on the road responsibly, with digital evidence, through E-Vigilance. Be a law-abiding driver, and join us today to protect the lives of tomorrow.',
    tryApp: 'Try app',
    ctaNote: 'Free · Works on any phone · No app store needed',

    stats: [
      { value: '1 min', label: 'to file a complaint' },
      { value: '10', label: 'photos or videos per report' },
      { value: '24/7', label: 'report any time, anywhere' },
      { value: 'Free', label: 'for every citizen' },
    ],
    mock: {
      place: 'Colombo 07',
      vehicle: 'Car',
      status: 'In Progress',
      submitted: 'Report submitted',
      located: 'Location attached',
    },

    objectiveTitle: 'Our objective',
    objectiveText:
      'Road safety depends on every road user. Many violations go unreported because there is no quick, reliable way to report them. E-Vigilance turns every smartphone into a reporting tool: citizens capture the evidence, and the traffic authorities receive a complete, verifiable report they can act on.',
    goals: [
      { title: 'Reduce accidents', text: 'Help remove dangerous driving from our roads by making it easy to report.' },
      { title: 'Support the authorities', text: 'Give the police clear evidence of what happened, where, when and which vehicle.' },
      { title: 'Transparent follow-up', text: 'See at any time whether your report is in progress, completed or rejected.' },
    ],

    howTitle: 'How it works',
    steps: [
      { title: 'Capture evidence', text: 'Take photos or video, or record a short voice note describing what you saw.' },
      { title: 'Add the details', text: 'Vehicle number and type, the violation, and the date and time.' },
      { title: 'Pin the location', text: 'Your GPS location is attached automatically, or you can type the place.' },
      { title: 'Submit and track', text: 'Your report goes to the traffic authority dashboard. Follow its status in the app.' },
    ],

    reportTitle: 'What you can report',
    violations: [
      'Running a red light',
      'Speeding',
      'Reckless driving',
      'Driving on the wrong side',
      'Illegal parking',
      'Using a mobile phone while driving',
      'No seat belt or helmet',
      'Drunk driving',
      'Overtaking in a no-overtaking zone',
      'Blocking an emergency vehicle',
      'No valid licence or insurance',
      'Noise or emission violations',
    ],

    featuresTitle: 'Why E-Vigilance',
    features: [
      { title: 'Works on any phone', text: 'Install it from your browser like an app. No app store needed.' },
      { title: 'Complete evidence', text: 'Up to 10 photos or videos and a voice note in every report.' },
      { title: 'Secure and private', text: 'Only you and the traffic authorities can see your reports.' },
      { title: 'Track your reports', text: 'See the status of every report you have filed in one place.' },
    ],

    stepLabel: 'Step',
    statuses: ['Submitted', 'In Progress', 'Completed'],
    reportHint: 'Tap a violation to report it',
    sawIt: 'Saw this on the road?',
    reportIt: 'Report it now',

    pledgeTitle: 'Take the road-safety pledge',
    pledgeIntro: 'Tick each promise you make today.',
    pledges: [
      'I will obey traffic signals and speed limits.',
      'I will not use my phone while driving.',
      'I will always wear a seat belt or helmet.',
      'I will report violations honestly, with real evidence.',
    ],
    pledgeDone: 'Thank you! You are a law-abiding road user. Join us today.',

    faqTitle: 'Questions and answers',
    faqs: [
      { q: 'Is E-Vigilance free?', a: 'Yes. It is free for every citizen and works in the browser on any phone or computer.' },
      { q: 'Who can see my complaint?', a: 'Only you and the traffic authorities. Other users cannot see your complaints or your personal details.' },
      { q: 'What happens after I submit?', a: 'Your complaint reaches the traffic authority dashboard, where officers review the evidence. Its status then changes to Completed or Rejected, and you can follow it in the app.' },
      { q: 'Do I need to install anything?', a: 'No. Open the app in your browser. If you like, add it to your home screen to use it like a normal app.' },
      { q: 'What makes a good complaint?', a: 'Clear photos or video showing the vehicle number, the exact location, and the date and time. A short voice note describing what happened also helps.' },
    ],

    responsibleTitle: 'Report responsibly',
    responsibleText:
      'Only report what you actually saw. False reports may be penalised. Never use the app while you are driving.',
    emergency: 'In an emergency, call the Police: 119',

    finalTitle: 'Ready to make our roads safer?',
    footer: 'E-Vigilance - citizens and traffic authorities working together for safer roads.',
  },

  si: {
    pageTitle: 'E-Vigilance - රථවාහන නීති කඩකිරීම් ගැන පැමිණිලි කරන්න',
    languageLabel: 'භාෂාව',
    eyebrow: 'E-Vigilance මහජන සුපරීක්ෂණ සේවාව',
    // The headline is two lines; the second is highlighted.
    title: ['සැලකිලිමත් වෙමු -', 'අනතුරු අවම කරමු!'],
    law: '1951 අංක 14 දරන මෝටර් වාහන පනත ප්‍රකාරව, මාර්ග නීති කඩකිරීම සහ නොසැලකිලිමත් රිය ධාවනය දඬුවම් ලැබිය හැකි වරදකි.',
    subtitle:
      "නීතිය සැමට සමානය. මාර්ගයේ ඔබ දකින අනතුරුදායක රිය පැදවීම් සහ නීති උල්ලංඝනය කිරීම් ඩිජිටල් සාක්ෂි සහිතව 'E-Vigilance' හරහා වගකීමෙන් යුතුව වාර්තා කරන්න. නීතිගරුක රියදුරෙකු වී, හෙට දවසේ ජීවිත සුරකින්න අදම අප හා එක්වන්න.",
    tryApp: 'යෙදුමට පිවිසෙන්න',
    ctaNote: 'නොමිලේ · ඕනෑම දුරකථනයකින් · බාගත කිරීමක් අවශ්‍ය නැත',

    stats: [
      { value: 'මිනිත්තු 1', label: 'පැමිණිල්ලක් කිරීමට' },
      { value: '10', label: 'එක් පැමිණිල්ලකට ඡායාරූප හෝ වීඩියෝ' },
      { value: '24/7', label: 'ඕනෑම වේලාවක, ඕනෑම තැනක' },
      { value: 'නොමිලේ', label: 'සියලු පුරවැසියන්ට' },
    ],
    mock: {
      place: 'කොළඹ 07',
      vehicle: 'මෝටර් රථය',
      status: 'ක්‍රියාත්මකයි',
      submitted: 'පැමිණිල්ල යොමු කළා',
      located: 'ස්ථානය එකතු විය',
    },

    objectiveTitle: 'අපේ අරමුණ',
    objectiveText:
      'මාර්ග ආරක්ෂාව අප සැමගේ වගකීමකි. එහෙත් පහසු ක්‍රමයක් නොමැති නිසා පාරේ සිදුවන බොහෝ නීති කඩකිරීම් පොලිසියට වාර්තා නොවේ. E-Vigilance මඟින් ඔබේ ජංගම දුරකථනයම පැමිණිලි කිරීමේ මෙවලමක් බවට පත්වේ. ඔබ සාක්ෂි ලබා දෙන අතර, රථවාහන බලධාරීන්ට ක්‍රියාමාර්ග ගැනීමට අවශ්‍ය සියලු තොරතුරු සහිත පැමිණිල්ලක් ලැබේ.',
    goals: [
      { title: 'අනතුරු අවම කිරීම', text: 'පැමිණිලි කිරීම පහසු වූ විට, අනතුරුදායක ලෙස රිය පදවන්නන් පාලනය කිරීමද පහසු වේ.' },
      { title: 'පොලිසියට සහාය', text: 'සිදුවූයේ කුමක්ද, කොහේද, කවදාද, කුමන වාහනයද යන්න පැහැදිලි සාක්ෂි සමඟ පොලිසියට ලැබේ.' },
      { title: 'විනිවිදභාවය', text: 'ඔබේ පැමිණිල්ල ක්‍රියාත්මක වෙමින්ද, අවසන්ද, ප්‍රතික්ෂේප වූවාද යන්න ඕනෑම වේලාවක දැනගන්න.' },
    ],

    howTitle: 'එය ක්‍රියා කරන්නේ කෙසේද?',
    steps: [
      { title: 'සාක්ෂි ලබාගන්න', text: 'ඡායාරූප හෝ වීඩියෝ ගන්න. නැතහොත් ඔබ දුටු දේ කෙටි හඬ පටයකින් පවසන්න.' },
      { title: 'විස්තර ඇතුළත් කරන්න', text: 'වාහන අංකය, වාහන වර්ගය, සිදුවූ වරද, දිනය සහ වේලාව.' },
      { title: 'ස්ථානය සලකුණු කරන්න', text: 'ඔබ සිටින ස්ථානය GPS මඟින් ස්වයංක්‍රීයව එකතු වේ. අවශ්‍ය නම් ස්ථානය ඔබම ඇතුළත් කළ හැක.' },
      { title: 'යොමු කර තත්ත්වය බලන්න', text: 'ඔබේ පැමිණිල්ල කෙලින්ම රථවාහන බලධාරීන් වෙත යයි. එහි ප්‍රගතිය යෙදුමෙන්ම බලාගන්න.' },
    ],

    reportTitle: 'පැමිණිලි කළ හැකි වැරදි',
    violations: [
      'රතු එළිය නොතකා ගමන් කිරීම',
      'වේග සීමාව ඉක්මවා යාම',
      'අවිචාරවත් ලෙස රිය පැදවීම',
      'පාරේ වැරදි පැත්තෙන් රිය පැදවීම',
      'නීති විරෝධී ලෙස වාහන නැවැත්වීම',
      'රිය පදවන අතරේ ජංගම දුරකථනය භාවිතය',
      'ආසන පටිය හෝ හිස් ආවරණය නොපැළඳීම',
      'බීමතින් රිය පැදවීම',
      'ඉස්සර කිරීම තහනම් ස්ථානවල ඉස්සර කිරීම',
      'ගිලන් රථ වැනි හදිසි වාහනවලට බාධා කිරීම',
      'බලපත්‍රයක් හෝ රක්ෂණයක් නොමැතිව රිය පැදවීම',
      'අධික ශබ්දය හෝ දුම් පිටවීම',
    ],

    featuresTitle: 'E-Vigilance ඇයි?',
    features: [
      { title: 'ඕනෑම දුරකථනයකින්', text: 'ඇප් ස්ටෝර් එකකින් බාගත කිරීමකින් තොරව, බ්‍රවුසරයෙන්ම යෙදුමක් ලෙස ස්ථාපනය කරගන්න.' },
      { title: 'සම්පූර්ණ සාක්ෂි', text: 'එක් පැමිණිල්ලකට ඡායාරූප හෝ වීඩියෝ 10ක් දක්වා සහ හඬ පටයක්.' },
      { title: 'ආරක්ෂිත හා රහසිගත', text: 'ඔබේ පැමිණිලි දැකිය හැක්කේ ඔබට සහ රථවාහන බලධාරීන්ට පමණි.' },
      { title: 'සියල්ල එකම තැනක', text: 'ඔබ කළ සියලු පැමිණිලිවල තත්ත්වය එකම තැනකින් බලාගන්න.' },
    ],

    stepLabel: 'පියවර',
    statuses: ['යොමු කළා', 'ක්‍රියාත්මකයි', 'අවසන්'],
    reportHint: 'පැමිණිලි කිරීමට වැරද්දක් තෝරන්න',
    sawIt: 'මාර්ගයේදී මෙය දුටුවාද?',
    reportIt: 'දැන්ම පැමිණිලි කරන්න',

    pledgeTitle: 'මාර්ග ආරක්ෂණ පොරොන්දුව දෙන්න',
    pledgeIntro: 'අද ඔබ දෙන සෑම පොරොන්දුවක්ම සලකුණු කරන්න.',
    pledges: [
      'මම රථවාහන සංඥා සහ වේග සීමා පිළිපදිමි.',
      'රිය පදවන අතරේ මම ජංගම දුරකථනය භාවිතා නොකරමි.',
      'මම සැමවිටම ආසන පටිය හෝ හිස් ආවරණය පළඳිමි.',
      'මම සැබෑ සාක්ෂි සහිතව, අවංකව පමණක් පැමිණිලි කරමි.',
    ],
    pledgeDone: 'ස්තූතියි! ඔබ නීතිගරුක මාර්ග භාවිතා කරන්නෙකි. අදම අප හා එක්වන්න.',

    faqTitle: 'නිතර අසන ප්‍රශ්න',
    faqs: [
      { q: 'E-Vigilance නොමිලේද?', a: 'ඔව්. සියලු පුරවැසියන්ට මෙය නොමිලේ වන අතර, ඕනෑම දුරකථනයක හෝ පරිගණකයක බ්‍රවුසරයෙන් භාවිතා කළ හැක.' },
      { q: 'මගේ පැමිණිල්ල දැකිය හැක්කේ කාටද?', a: 'ඔබට සහ රථවාහන බලධාරීන්ට පමණි. වෙනත් පරිශීලකයින්ට ඔබේ පැමිණිලි හෝ පෞද්ගලික තොරතුරු දැකිය නොහැක.' },
      { q: 'පැමිණිල්ල යොමු කළ පසු කුමක් සිදුවේද?', a: 'ඔබේ පැමිණිල්ල රථවාහන බලධාරීන්ගේ පාලක පුවරුවට ලැබෙන අතර, නිලධාරීන් සාක්ෂි පරීක්ෂා කරයි. ඉන්පසු එහි තත්ත්වය "අවසන්" හෝ "ප්‍රතික්ෂේපිත" ලෙස වෙනස් වන අතර, ඔබට එය යෙදුමෙන් බලාගත හැක.' },
      { q: 'මට කිසිවක් ස්ථාපනය කළ යුතුද?', a: 'නැත. බ්‍රවුසරයෙන් යෙදුම විවෘත කරන්න. අවශ්‍ය නම්, සාමාන්‍ය යෙදුමක් ලෙස භාවිතා කිරීමට එය ඔබේ මුල් තිරයට එක් කරගත හැක.' },
      { q: 'හොඳ පැමිණිල්ලකට අවශ්‍ය මොනවාද?', a: 'වාහන අංකය පැහැදිලිව පෙනෙන ඡායාරූප හෝ වීඩියෝ, නිවැරදි ස්ථානය, දිනය සහ වේලාව. සිදුවූ දේ විස්තර කරන කෙටි හඬ පටයක්ද ප්‍රයෝජනවත් වේ.' },
    ],

    responsibleTitle: 'වගකීමෙන් යුතුව පැමිණිලි කරන්න',
    responsibleText:
      'ඔබ ඇසින් දුටු දේ පමණක් පැමිණිලි කරන්න. බොරු පැමිණිලි සඳහා දඬුවම් ලැබිය හැක. රිය පදවන අතරේ කිසිසේත් යෙදුම භාවිතා නොකරන්න.',
    emergency: 'හදිසි අවස්ථාවකදී පොලිසිය අමතන්න: 119',

    finalTitle: 'මාර්ග ආරක්ෂාවට ඔබත් දායක වන්න.',
    footer: 'E-Vigilance - ආරක්ෂිත මාර්ග සඳහා මහජනතාව සහ රථවාහන බලධාරීන් එක්ව.',
  },

  ta: {
    pageTitle: 'E-Vigilance - போக்குவரத்து விதிமீறல்களை முறைப்பாடு செய்யுங்கள்',
    languageLabel: 'மொழி',
    eyebrow: 'E-Vigilance பொதுமக்கள் கண்காணிப்புச் சேவை',
    // The headline is two lines; the second is highlighted.
    title: ['கவனமாக இருப்போம் -', 'விபத்துகளைக் குறைப்போம்!'],
    law: '1951 ஆம் ஆண்டின் 14 ஆம் இலக்க மோட்டார் போக்குவரத்துச் சட்டத்தின்படி, வீதி விதிகளை மீறுவதும் கவனக்குறைவாக வாகனம் செலுத்துவதும் தண்டனைக்குரிய குற்றங்களாகும்.',
    subtitle:
      "சட்டம் அனைவருக்கும் சமமானது. வீதியில் நீங்கள் காணும் ஆபத்தான வாகனச் செலுத்துகைகளையும் சட்ட மீறல்களையும் டிஜிட்டல் ஆதாரங்களுடன் 'E-Vigilance' மூலம் பொறுப்புடன் முறைப்பாடு செய்யுங்கள். சட்டத்தை மதிக்கும் சாரதியாக இருந்து, நாளைய உயிர்களைப் பாதுகாக்க இன்றே எம்முடன் இணையுங்கள்.",
    tryApp: 'செயலியை முயற்சிக்கவும்',
    ctaNote: 'இலவசம் · எந்தத் தொலைபேசியிலும் இயங்கும் · செயலி அங்காடி தேவையில்லை',

    stats: [
      { value: '1 நிமிடம்', label: 'முறைப்பாடு செய்ய' },
      { value: '10', label: 'ஒரு முறைப்பாட்டுக்குப் புகைப்படங்கள் அல்லது வீடியோக்கள்' },
      { value: '24/7', label: 'எந்நேரமும், எங்கிருந்தும்' },
      { value: 'இலவசம்', label: 'அனைத்துக் குடிமக்களுக்கும்' },
    ],
    mock: {
      place: 'கொழும்பு 07',
      vehicle: 'கார்',
      status: 'செயல்பாட்டில்',
      submitted: 'முறைப்பாடு சமர்ப்பிக்கப்பட்டது',
      located: 'இருப்பிடம் இணைக்கப்பட்டது',
    },

    objectiveTitle: 'எமது நோக்கம்',
    objectiveText:
      'வீதிப் பாதுகாப்பு ஒவ்வொரு வீதிப் பயனாளரிலும் தங்கியுள்ளது. விரைவான, நம்பகமான வழி இல்லாததால் பல விதிமீறல்கள் முறைப்பாடு செய்யப்படாமல் போகின்றன. E-Vigilance ஒவ்வொரு ஸ்மார்ட்போனையும் முறைப்பாட்டுக் கருவியாக மாற்றுகிறது: குடிமக்கள் ஆதாரங்களைச் சேகரிக்கின்றனர்; போக்குவரத்து அதிகாரிகள் நடவடிக்கை எடுக்கக்கூடிய முழுமையான, சரிபார்க்கக்கூடிய முறைப்பாட்டைப் பெறுகின்றனர்.',
    goals: [
      { title: 'விபத்துகளைக் குறைத்தல்', text: 'முறைப்பாடு செய்வதை எளிதாக்குவதன் மூலம் ஆபத்தான வாகனச் செலுத்துகையை எமது வீதிகளிலிருந்து அகற்ற உதவுங்கள்.' },
      { title: 'அதிகாரிகளுக்கு உதவுதல்', text: 'என்ன நடந்தது, எங்கே, எப்போது, எந்த வாகனம் என்பதற்கான தெளிவான ஆதாரங்களைப் பொலிஸாருக்கு வழங்குங்கள்.' },
      { title: 'வெளிப்படையான பின்தொடர்தல்', text: 'உங்கள் முறைப்பாடு செயல்பாட்டில் உள்ளதா, நிறைவடைந்ததா அல்லது நிராகரிக்கப்பட்டதா என்பதை எந்நேரமும் பாருங்கள்.' },
    ],

    howTitle: 'இது எவ்வாறு செயல்படுகிறது',
    steps: [
      { title: 'ஆதாரங்களைப் பதிவு செய்யுங்கள்', text: 'புகைப்படங்கள் அல்லது வீடியோ எடுங்கள், அல்லது நீங்கள் கண்டதை விவரிக்கும் சிறிய குரல் குறிப்பைப் பதிவு செய்யுங்கள்.' },
      { title: 'விவரங்களைச் சேர்க்கவும்', text: 'வாகன இலக்கம் மற்றும் வகை, விதிமீறல், திகதி மற்றும் நேரம்.' },
      { title: 'இடத்தைக் குறிக்கவும்', text: 'உங்கள் GPS இருப்பிடம் தானாகவே இணைக்கப்படும், அல்லது இடத்தைத் தட்டச்சு செய்யலாம்.' },
      { title: 'சமர்ப்பித்துப் பின்தொடருங்கள்', text: 'உங்கள் முறைப்பாடு போக்குவரத்து அதிகாரிகளின் கட்டுப்பாட்டுப் பலகைக்குச் செல்லும். அதன் நிலையைச் செயலியில் பின்தொடருங்கள்.' },
    ],

    reportTitle: 'நீங்கள் முறைப்பாடு செய்யக்கூடியவை',
    violations: [
      'சிவப்புச் சமிக்ஞையை மீறிச் செல்லுதல்',
      'அதிவேகம்',
      'கவனக்குறைவாக வாகனம் செலுத்துதல்',
      'வீதியின் தவறான பக்கத்தில் வாகனம் செலுத்துதல்',
      'சட்டவிரோதமாக வாகனம் நிறுத்துதல்',
      'வாகனம் செலுத்தும்போது கைத்தொலைபேசி பயன்படுத்துதல்',
      'ஆசனப் பட்டி அல்லது தலைக்கவசம் அணியாமை',
      'மதுபோதையில் வாகனம் செலுத்துதல்',
      'முந்திச் செல்லத் தடைசெய்யப்பட்ட இடத்தில் முந்திச் செல்லுதல்',
      'அவசர சேவை வாகனத்திற்கு இடையூறு செய்தல்',
      'செல்லுபடியான அனுமதிப்பத்திரம் அல்லது காப்புறுதி இன்மை',
      'இரைச்சல் அல்லது புகை வெளியேற்ற விதிமீறல்கள்',
    ],

    featuresTitle: 'ஏன் E-Vigilance?',
    features: [
      { title: 'எந்தத் தொலைபேசியிலும் இயங்கும்', text: 'செயலி அங்காடி தேவையில்லை; உலாவியிலிருந்தே செயலியாக நிறுவிக்கொள்ளுங்கள்.' },
      { title: 'முழுமையான ஆதாரங்கள்', text: 'ஒவ்வொரு முறைப்பாட்டிலும் 10 புகைப்படங்கள் அல்லது வீடியோக்கள் வரை மற்றும் ஒரு குரல் குறிப்பு.' },
      { title: 'பாதுகாப்பானது, தனிப்பட்டது', text: 'உங்கள் முறைப்பாடுகளை நீங்களும் போக்குவரத்து அதிகாரிகளும் மட்டுமே பார்க்க முடியும்.' },
      { title: 'உங்கள் முறைப்பாடுகளைப் பின்தொடருங்கள்', text: 'நீங்கள் சமர்ப்பித்த ஒவ்வொரு முறைப்பாட்டின் நிலையையும் ஒரே இடத்தில் பாருங்கள்.' },
    ],

    stepLabel: 'படி',
    statuses: ['சமர்ப்பிக்கப்பட்டது', 'செயல்பாட்டில்', 'நிறைவடைந்தது'],
    reportHint: 'முறைப்பாடு செய்ய ஒரு விதிமீறலைத் தொடுங்கள்',
    sawIt: 'வீதியில் இதைக் கண்டீர்களா?',
    reportIt: 'இப்போதே முறைப்பாடு செய்யுங்கள்',

    pledgeTitle: 'வீதிப் பாதுகாப்பு உறுதிமொழி எடுங்கள்',
    pledgeIntro: 'இன்று நீங்கள் அளிக்கும் ஒவ்வொரு உறுதிமொழியையும் குறியிடுங்கள்.',
    pledges: [
      'போக்குவரத்துச் சமிக்ஞைகளையும் வேக வரம்புகளையும் நான் கடைப்பிடிப்பேன்.',
      'வாகனம் செலுத்தும்போது நான் கைத்தொலைபேசியைப் பயன்படுத்தமாட்டேன்.',
      'நான் எப்போதும் ஆசனப் பட்டி அல்லது தலைக்கவசம் அணிவேன்.',
      'உண்மையான ஆதாரங்களுடன் நேர்மையாக மட்டுமே முறைப்பாடு செய்வேன்.',
    ],
    pledgeDone: 'நன்றி! நீங்கள் சட்டத்தை மதிக்கும் வீதிப் பயனாளர். இன்றே எம்முடன் இணையுங்கள்.',

    faqTitle: 'அடிக்கடி கேட்கப்படும் கேள்விகள்',
    faqs: [
      { q: 'E-Vigilance இலவசமா?', a: 'ஆம். இது அனைத்துக் குடிமக்களுக்கும் இலவசம்; எந்தத் தொலைபேசியிலும் கணினியிலும் உலாவி மூலம் பயன்படுத்தலாம்.' },
      { q: 'எனது முறைப்பாட்டை யார் பார்க்க முடியும்?', a: 'நீங்களும் போக்குவரத்து அதிகாரிகளும் மட்டுமே. ஏனைய பயனாளர்கள் உங்கள் முறைப்பாடுகளையோ தனிப்பட்ட விவரங்களையோ பார்க்க முடியாது.' },
      { q: 'சமர்ப்பித்த பின் என்ன நடக்கும்?', a: 'உங்கள் முறைப்பாடு போக்குவரத்து அதிகாரிகளின் கட்டுப்பாட்டுப் பலகையைச் சென்றடையும்; அதிகாரிகள் ஆதாரங்களைப் பரிசீலிப்பார்கள். பின்னர் அதன் நிலை "நிறைவடைந்தது" அல்லது "நிராகரிக்கப்பட்டது" என மாறும்; அதைச் செயலியில் பின்தொடரலாம்.' },
      { q: 'ஏதாவது நிறுவ வேண்டுமா?', a: 'இல்லை. உலாவியில் செயலியைத் திறவுங்கள். விரும்பினால், சாதாரண செயலி போலப் பயன்படுத்த அதை முகப்புத் திரையில் சேர்க்கலாம்.' },
      { q: 'நல்ல முறைப்பாட்டுக்கு என்ன தேவை?', a: 'வாகன இலக்கம் தெளிவாகத் தெரியும் புகைப்படங்கள் அல்லது வீடியோ, சரியான இடம், திகதி மற்றும் நேரம். நடந்ததை விவரிக்கும் சிறிய குரல் குறிப்பும் உதவும்.' },
    ],

    responsibleTitle: 'பொறுப்புடன் முறைப்பாடு செய்யுங்கள்',
    responsibleText:
      'நீங்கள் உண்மையில் கண்டதை மட்டுமே முறைப்பாடு செய்யுங்கள். பொய்யான முறைப்பாடுகளுக்குத் தண்டனை வழங்கப்படலாம். வாகனம் செலுத்தும்போது ஒருபோதும் செயலியைப் பயன்படுத்த வேண்டாம்.',
    emergency: 'அவசர நிலையில் பொலிஸை அழையுங்கள்: 119',

    finalTitle: 'எமது வீதிகளைப் பாதுகாப்பானதாக்கத் தயாரா?',
    footer: 'E-Vigilance - பாதுகாப்பான வீதிகளுக்காகக் குடிமக்களும் போக்குவரத்து அதிகாரிகளும் இணைந்து.',
  },
};
