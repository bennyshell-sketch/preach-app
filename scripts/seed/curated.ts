/**
 * Editorial content for the seeded chapters.
 *
 * The word notes, verse commentary, insight cards and blessings below are
 * carried over verbatim from the `Preach.dc.html` prototype. They are the one
 * part of the corpus no open dataset supplies: a Strong's entry gives you
 * "kyrios: lord, master", not an explanation a reader with no Greek can use.
 * Ingested scripture is mechanical; this is written.
 */

// ─── Verse-of-the-day rotation ─────────────────────────────────────────────
// Ordered slots. get_today() picks `day_of_year % count`, so the same verse
// shows for everyone all day and moves on at midnight UTC.

export const DAILY_VERSES = [
  {
    seq: 1,
    ref: '2CO.3.17',
    original_text: 'ὁ δὲ κύριος τὸ πνεῦμά ἐστιν·',
    transliteration: 'ho dè Kýrios tò Pneûmá estín...',
    badge: 'GREEK · NT',
  },
  {
    seq: 2,
    ref: 'PSA.23.1',
    original_text: 'מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר',
    transliteration: 'mizmor l’David, YHWH ro’i lo echsar',
    badge: 'HEBREW · OT',
  },
  {
    seq: 3,
    ref: 'JHN.1.1',
    original_text: 'Ἐν ἀρχῇ ἦν ὁ λόγος',
    transliteration: 'En archē ēn ho logos',
    badge: 'GREEK · NT',
  },
  {
    seq: 4,
    ref: 'GEN.1.1',
    original_text: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
    transliteration: 'bereshit bara Elohim',
    badge: 'HEBREW · OT',
  },
  {
    seq: 5,
    ref: 'JHN.1.14',
    original_text: 'Καὶ ὁ λόγος σὰρξ ἐγένετο',
    transliteration: 'Kai ho logos sarx egeneto',
    badge: 'GREEK · NT',
  },
  {
    seq: 6,
    ref: 'PSA.23.4',
    original_text: 'גַּם כִּי אֵלֵךְ בְּגֵיא צַלְמָוֶת',
    transliteration: 'gam ki elech begei tsalmavet',
    badge: 'HEBREW · OT',
  },
  {
    seq: 7,
    ref: '2CO.3.18',
    original_text: 'μεταμορφούμεθα ἀπὸ δόξης εἰς δόξαν',
    transliteration: 'metamorphoumetha apo doxēs eis doxan',
    badge: 'GREEK · NT',
  },
];

// ─── Daily blessings ───────────────────────────────────────────────────────
// Ported verbatim from the prototype's BLESSINGS array.

export const BLESSINGS = [
  {
    ref: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the Lord — plans to prosper you and not to harm you, plans to give you hope and a future.',
    note: "This was spoken to people in their hardest season — in exile, far from home. God's plans for you are not on hold because of where you are. They are already in motion.",
  },
  {
    ref: 'Numbers 6:24–26',
    text: 'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.',
    note: 'This is the oldest blessing in the Bible — over 3,500 years old. It was spoken over ordinary people, every single day. It is still being spoken over you today.',
  },
  {
    ref: 'Isaiah 40:31',
    text: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
    note: "Waiting on God is not doing nothing. It's the posture of a bird riding a thermal — you're not standing still, you're being lifted by something far bigger than you.",
  },
  {
    ref: 'Psalm 91:11',
    text: 'For he will command his angels concerning you to guard you in all your ways.',
    note: 'You are not unprotected. You are not alone on the road. There are forces at work for you today that you cannot see — and they are not small.',
  },
  {
    ref: 'Romans 8:28',
    text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
    note: "Not some things. All things. Even the chapters you wouldn't have chosen for yourself. Especially those.",
  },
  {
    ref: 'Philippians 4:19',
    text: 'And my God will meet all your needs according to the riches of his glory in Christ Jesus.',
    note: "Paul wrote this from prison, with nothing. His confidence wasn't in his circumstances — it was in a God who simply does not run out.",
  },
  {
    ref: 'Isaiah 41:10',
    text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.',
    note: 'Five promises packed into two sentences. Count them. They belong to you today.',
  },
  {
    ref: 'Deuteronomy 28:6',
    text: 'You will be blessed when you come in and blessed when you go out.',
    note: 'Blessed in arrival. Blessed in departure. Covered in the ordinary, unremarkable rhythm of every single day.',
  },
  {
    ref: 'Psalm 23:6',
    text: 'Surely goodness and mercy shall follow me all the days of my life, and I will dwell in the house of the Lord forever.',
    note: "Goodness and mercy aren't waiting ahead of you somewhere. They're already behind you, following. You have never been outside their reach.",
  },
  {
    ref: 'Matthew 6:33',
    text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.',
    note: 'This is a promise disguised as an instruction. The seeking is what opens the receiving.',
  },
  {
    ref: 'Psalm 37:4',
    text: 'Take delight in the Lord, and he will give you the desires of your heart.',
    note: 'The more you know Him, the more your desires start to look like His gifts. And then everything He gives feels like coming home.',
  },
  {
    ref: 'Lamentations 3:22–23',
    text: "Because of the Lord's great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness.",
    note: "New mercy this morning. Not leftover mercy from yesterday. Fresh, specific to today, made for exactly what you're walking into.",
  },
  {
    ref: 'Ephesians 3:20',
    text: 'Now to him who is able to do immeasurably more than all we ask or imagine, according to his power that is at work within us.',
    note: 'Whatever you are asking God for right now — He is capable of doing more than that. Immeasurably more. Not as a slogan. As a fact.',
  },
  {
    ref: '2 Corinthians 9:8',
    text: 'And God is able to bless you abundantly, so that in all things at all times, having all that you need, you will abound in every good work.',
    note: "Abundance here isn't surplus for yourself — it's having enough to give freely. That is a richer, deeper kind of full.",
  },
];

// ─── Insight cards (Today tab, "About This Verse") ─────────────────────────

export const INSIGHTS: { ref: string; kind: 'background' | 'scholar' | 'application'; body: string }[] = [
  {
    ref: '2CO.3.17',
    kind: 'background',
    body: 'Paul wrote this letter around 55 AD while travelling through Macedonia. Some people were doubting him — and in defending himself, he made one of the most extraordinary claims in all of Scripture about who the Holy Spirit really is.',
  },
  {
    ref: '2CO.3.17',
    kind: 'scholar',
    body: "Gordon Fee, a leading New Testament scholar, described it simply: the Holy Spirit isn't separate from Jesus — it's how Jesus is present with you right now. Same God. Different way of experiencing Him. That's why worshipping in the Spirit is worshipping Jesus.",
  },
  {
    ref: '2CO.3.17',
    kind: 'application',
    body: 'In the Old Testament, only Moses could stand that close to God. Everyone else waited at a distance. Paul is saying that distance is gone. The same God who shook Mount Sinai lives in you now — simply because you turned to Him.',
  },
  {
    ref: 'PSA.23.1',
    kind: 'background',
    body: 'David wrote this as someone who had actually been a shepherd — he knew exactly how much work it took to keep a flock fed, watered and safe. He is not reaching for a pretty image. He is saying: God does for me what I used to do for them.',
  },
  {
    ref: 'PSA.23.1',
    kind: 'scholar',
    body: 'The Hebrew here is startlingly compact — four words, "YHWH ro’i lo echsar". Hebrew scholars note there is no verb "is" in the original: it reads more like "The Lord, my shepherd — I lack nothing." The relationship is stated as simple fact.',
  },
  {
    ref: 'PSA.23.1',
    kind: 'application',
    body: 'Notice what David does not say: that he has everything he wants. He says he lacks nothing he needs. Those are different sentences, and learning the difference between them is most of what it means to be at peace.',
  },
  {
    ref: 'JHN.1.1',
    kind: 'background',
    body: 'John opens his Gospel with the same three words that open the Hebrew Bible — "In the beginning". His first-century readers would have felt the echo instantly. He is not starting a story. He is restarting Genesis.',
  },
  {
    ref: 'JHN.1.1',
    kind: 'scholar',
    body: '"Logos" was a word Greek philosophers had used for centuries to mean the rational principle holding the universe together. John takes their biggest abstract idea and says: this is not a principle. This is a person, and you can meet him.',
  },
  {
    ref: 'JHN.1.1',
    kind: 'application',
    body: 'Whatever you think was at the foundation of everything — chance, matter, force — John’s claim is that it was a voice. Something that speaks, and therefore something that can speak to you.',
  },
  {
    ref: 'GEN.1.1',
    kind: 'background',
    body: 'Genesis was written to people surrounded by creation myths in which the world is made from the corpse of a defeated god, and humans are made as slaves. Genesis 1 is a quiet, deliberate contradiction of all of it.',
  },
  {
    ref: 'GEN.1.1',
    kind: 'scholar',
    body: 'The verb "bara" — create — is only ever used in the Hebrew Bible with God as its subject. Humans make, shape and build; only God "baras". The grammar itself is making a theological claim.',
  },
  {
    ref: 'GEN.1.1',
    kind: 'application',
    body: 'The chapter’s repeated verdict is "and it was good". Before anything went wrong, before any rule was given, the first thing said about the material world — and about you in it — was that it is good.',
  },
  {
    ref: 'JHN.1.14',
    kind: 'background',
    body: '"Made his dwelling" is literally "pitched his tent" — the same word the Greek Old Testament uses for the tabernacle in the wilderness. John is saying God has moved back into the neighbourhood, and this time the tent is a body.',
  },
  {
    ref: 'JHN.1.14',
    kind: 'scholar',
    body: 'Scholars point out how deliberately jarring this sentence is in Greek. "Logos" was the most abstract word available; "sarx" (flesh) was among the most concrete and least dignified. Putting them in one sentence was, to a Greek ear, almost offensive.',
  },
  {
    ref: 'JHN.1.14',
    kind: 'application',
    body: 'Whatever you are carrying in a body today — exhaustion, pain, hunger, grief — was carried in one by God himself. That is not a consolation prize. It is the centre of the claim.',
  },
  {
    ref: 'PSA.23.4',
    kind: 'background',
    body: 'The valley David has in mind is a real feature of shepherding country: narrow ravines where the walls block the light and a predator can be on you before you see it. Sheep would not walk into one alone.',
  },
  {
    ref: 'PSA.23.4',
    kind: 'scholar',
    body: 'This is the hinge of the psalm, and Hebrew marks it: up to here David speaks about God — "he leads", "he restores". From here on he speaks to God — "you are with me". Trouble is what moves the relationship into second person.',
  },
  {
    ref: 'PSA.23.4',
    kind: 'application',
    body: 'He does not say the valley is avoided, shortened, or explained. He says it is walked through, accompanied. The promise is not a different road. It is company on this one.',
  },
  {
    ref: '2CO.3.18',
    kind: 'background',
    body: 'Paul has spent the whole chapter on Moses coming down Sinai with a veiled, fading radiance. Here he turns it around: the glory on an ordinary believer is unveiled, and it is increasing rather than fading.',
  },
  {
    ref: '2CO.3.18',
    kind: 'scholar',
    body: 'The verb behind "transformed" is "metamorphoumetha" — the root of metamorphosis. It is passive and continuous: this is something being done to you, over time, not something you achieve in a moment.',
  },
  {
    ref: '2CO.3.18',
    kind: 'application',
    body: 'From one degree of glory to another. Not from failure to glory in one leap. If you are further along than you were a year ago, that is precisely the sentence describing what is happening to you.',
  },
];

// ─── Verse commentary (the ✦ sheet in the Read tab) ────────────────────────

export const COMMENTARY: { ref: string; note: string }[] = [
  {
    ref: '2CO.3.14',
    note: 'Paul is comparing two ways of reading Scripture. Some read Moses and still see it as the final word. Paul says reading Moses without Christ is like reading a letter with the envelope still sealed — the full message is hidden until you find the key. Christ is the key.',
  },
  {
    ref: '2CO.3.15',
    note: "Every time Moses is read, a veil covers the heart, Paul says. He's not criticising Jewish people. He's making a point about revelation: the Old Covenant was always pointing forward to something it couldn't fully show. Like a road sign is not the destination.",
  },
  {
    ref: '2CO.3.16',
    note: "The word 'turn' here is the same Greek word for repentance — turning back. The moment you turn toward God, the veil comes off. Not after you've cleaned up. Not after you've been good enough. The moment you simply turn — it is removed.",
  },
  {
    ref: '2CO.3.17',
    note: "This is one of the most astonishing sentences in the Bible. Paul says the Lord IS the Spirit. Not 'like' the Spirit. Not 'represented by' the Spirit. IS. The same God who parted the Red Sea, who spoke from the burning bush — you encounter Him right now through the Holy Spirit. And where He is, freedom is.",
  },
  {
    ref: '2CO.3.18',
    note: "This is the most hopeful sentence in this passage. Being transformed 'from glory to glory' means it's a process, not a destination. You are not expected to arrive all at once. Every time you turn to God, something changes in you. A little more. A little more. Like a face turning toward the sun.",
  },
  {
    ref: 'GEN.1.1',
    note: 'Six words in Hebrew. No argument, no defence, no attempt to prove anything — just a statement made calmly. Everything else in the Bible rests on this sentence being true, and it is offered without a single supporting clause.',
  },
  {
    ref: 'GEN.1.3',
    note: 'Notice the mechanism: God speaks, and it is. Not builds, not fights, not shapes from something pre-existing. In the creation stories of Israel’s neighbours, making a world took a war. Here it takes a sentence.',
  },
  {
    ref: 'GEN.1.27',
    note: 'In the ancient Near East, "the image of God" was a phrase used of kings, and of statues placed in temples to represent an absent deity. Genesis applies it to every human being without exception. That was, in its context, a genuinely radical redistribution.',
  },
  {
    ref: 'PSA.23.1',
    note: 'David had actually done this job. He knew what it cost to keep sheep alive — the early mornings, the predators, the endless counting. When he says the Lord is his shepherd, he is not picking a gentle image. He is naming someone who works hard on his behalf.',
  },
  {
    ref: 'PSA.23.4',
    note: 'The psalm switches from talking about God to talking to God exactly here, in the valley. That is not a literary accident. Difficulty is often where a relationship stops being theoretical.',
  },
  {
    ref: 'PSA.23.6',
    note: 'The word behind "follow" is stronger than it sounds in English — it is closer to "pursue", the word used for chasing down an enemy. Goodness and mercy are not trailing politely behind you. They are hunting you down.',
  },
  {
    ref: 'JHN.1.1',
    note: 'Three claims in one sentence, each one raising the stakes: the Word already existed, the Word was with God, the Word was God. John spends the rest of the Gospel showing you the face of the person he has just described.',
  },
  {
    ref: 'JHN.1.5',
    note: 'The verb translated "overcome" can also mean "grasp" or "understand" — and John almost certainly intends both. The darkness neither defeated the light nor comprehended it.',
  },
  {
    ref: 'JHN.1.14',
    note: 'This is the sentence Christianity stands or falls on. Not that God sent a message, or a prophet, or a principle — that God took on a body, with all the hunger and tiredness and mortality that implies, and lived here.',
  },
];

// ─── Cross references for the seeded chapters ──────────────────────────────
// Hand-picked rather than bulk-imported: these are the ones with real
// interpretive weight, which is what the reader sheet is for.

export const CROSS_REFS: { from: string; to: string; toEnd?: string; votes: number }[] = [
  { from: '2CO.3.14', to: 'EXO.34.33', toEnd: 'EXO.34.35', votes: 90 },
  { from: '2CO.3.14', to: 'ROM.11.25', votes: 70 },
  { from: '2CO.3.14', to: 'JHN.5.39', votes: 60 },
  { from: '2CO.3.15', to: 'ISA.6.9', toEnd: 'ISA.6.10', votes: 80 },
  { from: '2CO.3.15', to: 'MAT.13.13', votes: 65 },
  { from: '2CO.3.15', to: 'ACT.28.26', toEnd: 'ACT.28.27', votes: 55 },
  { from: '2CO.3.16', to: 'EXO.34.34', votes: 95 },
  { from: '2CO.3.16', to: 'ACT.3.19', votes: 70 },
  { from: '2CO.3.16', to: 'JAS.4.8', votes: 60 },
  { from: '2CO.3.17', to: 'JHN.4.24', votes: 88 },
  { from: '2CO.3.17', to: 'ROM.8.2', votes: 85 },
  { from: '2CO.3.17', to: 'GAL.5.1', votes: 92 },
  { from: '2CO.3.17', to: 'JHN.8.36', votes: 78 },
  { from: '2CO.3.18', to: 'ROM.8.29', votes: 86 },
  { from: '2CO.3.18', to: 'PHP.3.21', votes: 64 },
  { from: '2CO.3.18', to: '1JN.3.2', votes: 74 },
  { from: '2CO.3.18', to: 'ROM.12.2', votes: 80 },

  { from: 'GEN.1.1', to: 'JHN.1.1', votes: 99 },
  { from: 'GEN.1.1', to: 'HEB.11.3', votes: 82 },
  { from: 'GEN.1.1', to: 'PSA.33.6', votes: 76 },
  { from: 'GEN.1.1', to: 'COL.1.16', votes: 88 },
  { from: 'GEN.1.3', to: '2CO.4.6', votes: 84 },
  { from: 'GEN.1.3', to: 'JHN.1.5', votes: 70 },
  { from: 'GEN.1.26', to: 'PSA.8.5', toEnd: 'PSA.8.6', votes: 72 },
  { from: 'GEN.1.27', to: 'GEN.5.1', votes: 66 },
  { from: 'GEN.1.27', to: 'COL.3.10', votes: 68 },
  { from: 'GEN.1.31', to: '1TI.4.4', votes: 60 },

  { from: 'PSA.23.1', to: 'JHN.10.11', votes: 97 },
  { from: 'PSA.23.1', to: 'ISA.40.11', votes: 80 },
  { from: 'PSA.23.1', to: 'EZK.34.11', toEnd: 'EZK.34.12', votes: 72 },
  { from: 'PSA.23.1', to: 'PHP.4.19', votes: 68 },
  { from: 'PSA.23.4', to: 'ISA.41.10', votes: 90 },
  { from: 'PSA.23.4', to: 'ROM.8.38', toEnd: 'ROM.8.39', votes: 78 },
  { from: 'PSA.23.4', to: 'HEB.13.5', votes: 74 },
  { from: 'PSA.23.6', to: 'PSA.27.4', votes: 70 },
  { from: 'PSA.23.6', to: 'JHN.14.2', toEnd: 'JHN.14.3', votes: 76 },

  { from: 'JHN.1.1', to: 'GEN.1.1', votes: 99 },
  { from: 'JHN.1.1', to: '1JN.1.1', votes: 85 },
  { from: 'JHN.1.1', to: 'REV.19.13', votes: 68 },
  { from: 'JHN.1.1', to: 'COL.1.17', votes: 80 },
  { from: 'JHN.1.5', to: 'JHN.8.12', votes: 82 },
  { from: 'JHN.1.5', to: '1JN.2.8', votes: 62 },
  { from: 'JHN.1.12', to: 'ROM.8.15', votes: 78 },
  { from: 'JHN.1.12', to: 'GAL.3.26', votes: 74 },
  { from: 'JHN.1.14', to: 'EXO.40.34', toEnd: 'EXO.40.35', votes: 84 },
  { from: 'JHN.1.14', to: 'PHP.2.7', votes: 86 },
  { from: 'JHN.1.14', to: 'COL.2.9', votes: 79 },
  { from: 'JHN.1.29', to: 'ISA.53.7', votes: 88 },
  { from: 'JHN.1.29', to: 'EXO.12.3', votes: 70 },
  { from: 'JHN.1.29', to: '1PE.1.19', votes: 82 },
];

// ─── Word-level plain-language notes ───────────────────────────────────────
// Keyed by Strong's id. These are what the interlinear popover shows under the
// heading — the "plain-language scholarly note" the reader actually reads.
// The 2 Corinthians 3:17 entries are the prototype's own text.

export const STRONGS_NOTES: Record<string, string> = {
  G2962:
    'Kyrios means "Lord" — but it’s the same word the ancient Greek Bible used for God’s own personal name, YHWH. When Paul says "the Lord is the Spirit," he’s placing Jesus in that same space. The God of Abraham, Moses, and the burning bush — that’s who you’re encountering when you experience the Holy Spirit. That’s a breathtaking claim.',
  G4151:
    'Pneuma is the Greek word for breath, wind, or spirit — the same word used when God breathed life into Adam. You can’t see wind, but you feel it, and it moves everything it touches. Paul is saying God’s own breath, His living presence, is in you. Not a distant force. A Person, as close as the air in your lungs.',
  G1510:
    'This tiny word — "is" — carries enormous weight. Paul doesn’t say the Lord is like the Spirit, or represented by the Spirit. He says IS. A direct equation. Like saying "fire is hot." Theologians have spent centuries unpacking this one word, and it sits at the heart of everything Christians believe about the Trinity.',
  G3757:
    '"Where" — not "if" or "someday." Wherever the Spirit shows up, freedom is already there waiting for you. You don’t have to earn it or work yourself up to it. It’s like warmth and sunlight — one comes with the other. You just have to step into it.',
  G1657:
    'In Paul’s world, a freed slave wasn’t just their own boss — they were adopted into their liberator’s family. That’s the freedom Paul means here. Not "do whatever you want." Deeper: you’re not just released, you’re welcomed in. You belong somewhere now. The veil keeping you at arm’s length from God — it’s gone.',
  G3056:
    'Logos means word, reason, or the logic behind a thing. Greek philosophers used it for the invisible order holding the universe together. John borrows their most abstract idea and does something outrageous with it: he says this ordering principle has a face, a name, and a mother.',
  G4561:
    'Sarx — flesh. Not "body" in a dignified, philosophical sense. This is meat, muscle, the part of you that gets tired and hungry and eventually dies. John chose the least elegant word available on purpose. God did not visit in a disguise. He became this.',
  G4637:
    'Literally "pitched a tent". It is the same word the Greek Old Testament uses for the tabernacle — the tent where God’s presence camped among the Israelites in the desert. John’s readers would have caught it instantly: God has moved back in, and this time the tent is a human being.',
  G5457:
    'Light, in John, is never only illumination — it is exposure and it is life. Things grow in it and things are seen truly by it. When he says the light shines in the darkness, he means both: something is being revealed, and something is being made alive.',
  G2222:
    '"Zoe" is life in the fullest sense — not merely being alive, which Greek had another word for, but life that is going somewhere and is worth having. When John says this life was the light of men, he means the two are the same gift seen from two angles.',
  H0430:
    'Elohim is grammatically plural but takes singular verbs throughout Genesis 1 — a construction Hebrew uses for majesty rather than number. The very first name for God in the Bible is one that stretches the language it is written in.',
  H1254:
    'Bara — to create. In the entire Hebrew Bible, this verb never takes a human subject. People make, form, build and shape; only God baras. The grammar quietly makes a claim before the theology does.',
  H7225:
    '"Reshit" means the first, the beginning, the choicest part of something. It is the same word used for the first fruits of a harvest. There is a hint in it that the beginning was not merely earliest, but best.',
  H7462:
    'Ro’eh — shepherd. David is not reaching for a soft image; he had done the job. It meant sleeping outside, fighting off predators and counting animals in the dark. When he calls God his shepherd he is describing someone who works hard on his behalf.',
  H3068:
    'YHWH — the personal name God gives himself at the burning bush, so revered in Jewish tradition that it is not spoken aloud. English Bibles render it as LORD in small capitals. Every time you see that, this name is underneath it.',
  H6757:
    'Tsalmavet — usually translated "shadow of death", and possibly built from the words for shadow and death. Whether or not the etymology holds, the sense is the same: the darkest ravine on the route, the place where you cannot see what is ahead.',
  H2617:
    'Chesed is one of the hardest words in the Hebrew Bible to translate — mercy, steadfast love, loyal kindness. It describes commitment that persists when the relationship gives it no reason to. English needs a phrase where Hebrew has a word.',
};

// ─── Healing circles ───────────────────────────────────────────────────────

export const CIRCLES = [
  { topic: 'Grief & Loss', icon: '🕊', accent: '#8b6fd0', description: 'For anyone carrying a loss, however recent or old.' },
  { topic: 'Anxiety & Fear', icon: '🌿', accent: '#4aab9e', description: 'A quiet room for anxious minds.' },
  { topic: 'Relationships', icon: '💛', accent: '#c9a86c', description: 'Marriage, family, friendship — the hard and the hopeful.' },
  { topic: 'Identity & Purpose', icon: '🔑', accent: '#2d3d56', description: 'Questions about who you are and what you are for.' },
  { topic: 'Addiction & Recovery', icon: '🌱', accent: '#4aab9e', description: 'One day at a time, with people who understand.' },
];
