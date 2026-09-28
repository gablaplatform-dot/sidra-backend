// Uganda's district count is genuinely in flux (new districts are periodically carved out by
// Parliament - sources in 2026 cite anywhere from 135 to 150 depending on which have actually
// been operationalized). This is a best-effort baseline (135 districts + Kampala, per Wikipedia's
// "Districts of Uganda"), compiled via an automated fetch and only spot-checked, not verified
// entry-by-entry against an official government source. Treat as a seed to correct/extend over
// time, not a guaranteed-exhaustive list - a district missing here just won't appear in the
// picker until added.
export const UGANDA_DISTRICTS = Object.freeze(
  [
    "Abim", "Adjumani", "Agago", "Alebtong", "Amolatar", "Amudat", "Amuria", "Amuru", "Apac", "Arua",
    "Budaka", "Bududa", "Bugiri", "Bugweri", "Buhweju", "Buikwe", "Bukedea", "Bukomansimbi", "Bukwo",
    "Buliisa", "Bulambuli", "Bundibugyo", "Bunyangabu", "Bushenyi", "Busia", "Butaleja", "Butambala",
    "Butebo", "Buvuma", "Buyende", "Gomba", "Gulu", "Hoima", "Ibanda", "Iganga", "Isingiro", "Jinja",
    "Kaabong", "Kabale", "Kaberamaido", "Kabarole", "Kagadi", "Kakumiro", "Kalaki", "Kalangala",
    "Kaliro", "Kalungu", "Kampala", "Kamuli", "Kamwenge", "Kanungu", "Kapchorwa", "Kapelebyong",
    "Karenga", "Kasanda", "Kasese", "Katakwi", "Kayunga", "Kazo", "Kibale", "Kiboga", "Kibuku",
    "Kikuube", "Kiruhura", "Kiryandongo", "Kisoro", "Kitagwenda", "Kitgum", "Koboko", "Kole",
    "Kotido", "Kumi", "Kwania", "Kween", "Kyankwanzi", "Kyegegwa", "Kyenjojo", "Kyotera", "Lamwo",
    "Lira", "Luuka", "Luweero", "Lwengo", "Lyantonde", "Madi-Okollo", "Manafwa", "Maracha", "Masaka",
    "Masindi", "Mayuge", "Mbale", "Mbarara", "Mitooma", "Mityana", "Moroto", "Moyo", "Mpigi",
    "Mubende", "Mukono", "Nabilatuk", "Nakapiripirit", "Nakaseke", "Nakasongola", "Namayingo",
    "Namisindwa", "Namutumba", "Napak", "Nebbi", "Ngora", "Ntoroko", "Ntungamo", "Nwoya", "Obongi",
    "Omoro", "Otuke", "Oyam", "Pader", "Pakwach", "Pallisa", "Rakai", "Rubanda", "Rubirizi", "Rukiga",
    "Rukungiri", "Rwampara", "Sembabule", "Serere", "Sheema", "Sironko", "Soroti", "Terego", "Tororo",
    "Wakiso", "Yumbe", "Zombo"
  ].sort()
);
