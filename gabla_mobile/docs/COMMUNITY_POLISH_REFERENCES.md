# Jobs and Events polish references

Pass: 5 November 2026. Scope: `lib/features/community` only. The parent owns global theme tokens and runs Flutter checks and rendered previews sequentially. No Flutter commands, commits or pushes were run for this pass.

## Research evidence

Public Pinterest pin pages were fetched directly and their published preview images inspected. Pinterest's text browsing endpoint rejected these pins; direct public-page metadata and preview images worked. The user-supplied Evenfonic pin was also opened and visually inspected in the browser. Some Pinterest metadata canonicalizes pins to a different pin ID; both IDs are recorded below. These are layout references, not assets included in the app. Descriptions below report what was visible in the reference images, rather than adopting Pinterest's generated descriptions.

| ID | Exact Pinterest source | Observed composition and adaptation |
|---|---|---|
| E1 | [Evenfonic — Event App Concept](https://www.pinterest.com/pin/821203313317364231/) | Two screens: compact discovery header, concert-photo cards, and a photo-led detail screen with clear date/location rows. Adapted event photo → title → facts → action ordering; removed the previous generic concert photo and promotional claims. Original creator link: [Dribbble](https://dribbble.com/shots/16870546-Evenfonic-Event-App-Concept). |
| J1 | [Jobify — Modern Job Finder](https://www.pinterest.com/pin/619385755042076715/) ([metadata canonical pin](https://www.pinterest.com/pin/473229873367805452/)) | Organization line, prominent role title, quiet work metadata, compact job cards. Adapted title-first hierarchy for browse, saved, mine and application records. No fabricated applicant counts or company logos. Original creator page: [Behance](https://www.behance.net/gallery/234127099/Jobify-Modern-Job-Finder-App-Branding). |
| F1 | [Create Event Form — Dark & Light](https://www.pinterest.com/pin/265430971781513819/) | External labels, rectangular compact fields, grouped dates/location, clear attachment rows and a separated final action. Applied to both job and event editors and the existing application form's community theme. Original creator: [Dmitry Sergushkin on Dribbble](https://dribbble.com/shots/20685620-Create-Event-Form-Dark-Light). |
| F2 | [FocoTik — Create Event Flow](https://www.pinterest.com/pin/875176140092114838/) | Media-first editor and preview, tonal form sections, explicit start/end fields. Applied to Cinematic's attachments-first editor and separated detail facts. No reference imagery is shipped. Original: [Dribbble](https://dribbble.com/shots/25422519-Event-UI-UX-Mobile-App-Design-Create-Event-Flow). |
| E2 | [Event Discovery / Instant — Orbix](https://www.pinterest.com/pin/930204498050366574/) ([metadata canonical pin](https://www.pinterest.com/pin/638807528442505019/)) | Image-led feed and detail with date, location and price hierarchy. Adapted clear image/facts separation and saved-event intent. Ticket tiers, attendee avatars, payment and chat were not introduced because Gabla does not provide those actions here. |
| J2 | [Mobile app for job search](https://www.pinterest.com/pin/1049620256922176279/) | Colored discovery panels, salary emphasis and qualifications below role information. Adapted restrained selected-palette accents and clear pay/requirements sections. Omitted portraits, decorative imagery, fake salaries and recommendation claims. |
| J3 | [Modern Job Finder — Mansi Vithani](https://www.pinterest.com/pin/877076096198414363/) ([metadata canonical pin](https://www.pinterest.com/pin/619948705001171027/)) | Dark tonal hierarchy, prominent role title and compact metadata. Adapted Cinematic section weight and Orbit's compact role rows. Omitted glass effects, capsule controls and decorative floating company badges. |

## Page-by-page adaptation

Every page below was considered against the inspected Pinterest sources. Sources are intentionally reused across related pages so navigation, records and forms remain coherent. No dedicated application-tracker or empty-state pin was visually verified in this pass; application and empty-state designs adapt the verified job-card and form hierarchy, not an invented source.

| Page / state | Sources | Concrete change |
|---|---|---|
| Jobs browse | J1, J2, J3 | Short accurate heading; vacancy/task choice and real search/filter controls retained. Role title, employer, workplace, location, pay and declared pay period form a readable hierarchy. No synthetic job imagery. |
| Events browse | E1, E2 | Short heading and category/search controls, followed by uploaded posters and readable title/date/place/entrance facts. No marketing image preceding the listings. |
| Job details | J1, J2, J3 | No large blank image area when no upload exists. Pay, actual declared pay period, employment/workplace, address, deadline, description and requirements. Existing applications, contact, map, gallery, share and ownership actions retained. |
| Event details | E1, E2, F2 | Uploaded photo above event title; date, end time, venue/address and entrance information below. Existing going/save/booking/contact/map actions retained. Missing media uses a compact icon, never a substitute event photo. |
| Create / edit job | F1, J1 | Required markers and description guidance, grouped fields, keyboard types for contact/URLs, visible error next to submit. Editing copy explains renewed review. Numeric validation checks hidden pay fields in stepped/tabbed forms. |
| Create / edit event | F1, F2 | Media-first Cinematic composition; other designs use outlined, ruled, stepped or tabbed sections. Real poster requirement and all date/location/search/map/upload fields retained. |
| Application sheet | F1, J1 | Precise “Apply for this job” title; existing cover letter, phone and HTTPS portfolio/CV fields and Send application behavior retained. Community form geometry and selected typography remain in scope. |
| My applications | J1, F1 | Status → role → employer → applied date → actions. Open the actual job, withdraw with an in-flight guard, refresh the list. No fake progress stages or counts. |
| Applicants | J1, F1 | Status and applicant name above actual contact information and cover letter. Portfolio/CV link and reviewed/shortlisted/declined actions remain. Selected status and in-flight actions disable appropriately. |
| Saved jobs / events | J1, E2 | Dedicated scope heading. Events copy explicitly includes interested/going responses, reflecting the actual endpoint. Empty state explains how to save and offers a real browse route. |
| My jobs / events | J1, F1, F2 | Dedicated management heading, real post status and existing detail management actions. Empty state explains review and links to create. |
| Search / collection / application empty states | J1, F1 | Small fitting icon, specific heading, concise explanation, and appropriate reset, browse, create or view-post action. No invented listings or filler artwork. |

## Five distinct restrained compositions

| Design | Browse and records | Details | Editor |
|---|---|---|---|
| Gabla | Selected-palette heading panel; stacked cards, optional uploaded event photo, facts below | Compact image when present, then organization/title | Outlined section groups with external labels |
| Editorial | Open typography, hairline rules; optional side image only where width/text scale allows | Title-first with rules and optional media | Sequential open sections with underlined controls |
| Discover | Icon beside heading; image/facts separated by a slim accent rule | Optional image and a compact raised title panel | Four guided sections and a progress rail |
| Cinematic | Tonal heading with left rule; uploaded event media above a category/title/facts block | Uploaded image above a tonal title band | Media first, then tonal sections with left rules |
| Orbit | Ruled heading; bounded compact icon/thumbnail and facts rows that stack for narrow/large text | Organization and thumbnail/title row | Compact tabbed workspace and an actionable factual checklist |

All colors come from the active `ColorScheme`; display type uses `AppTypography`. The existing per-community theme remains. Existing `DesignEntrance` and reduced-motion-aware step transitions remain. No font, global palette, background motion or core changes were made.

## Imagery removal and ownership handoff

- Removed every `Image.asset`, `AssetImage`, `assets/artwork/*` and `assets/categories/*` reference from community (the generated `community-concert.png` references were in `community_design.dart` and `community_screens.dart`).
- Added a compact theme-aware `CommunityMediaPlaceholder` using fitting event/work icons with design-specific alignment/rules/frames. No external stock photos were added: a substitute poster could misrepresent an actual event.
- Preserved real uploaded `Image.network` media, upload controls, video playback and image gallery behavior.
- Parent asset-test handoff: `test/community_test.dart:212–214` still precaches `assets/artwork/jobs.png` / `events.png`; remove that precache with the asset cleanup. No generated-asset references were found in `test/community_interaction_test.dart`.
- No assets or tests were deleted or edited. Existing `docs/COMMUNITY_DESIGN_REFERENCES.md` belongs outside this pass and still describes the old generated concert image; this new document supersedes that imagery guidance. Parent should reconcile that old note if retaining it.
- Source changes: `presentation/community_design.dart`, `presentation/community_screens.dart`, `presentation/community_editor_screen.dart`, `application/community_providers.dart`. `community_location_input.dart` was inspected and left unchanged.

## Validation and remaining review

Standalone Dart SDK formatting parsed the owned Dart sources successfully. Scoped `git diff --check` passed. No Flutter command, analyzer, test, build or screenshot generation was run. Runtime/visual claims in the old references file are not results from this pass.

Parent should run its sequential Flutter checks and render the five styles for browse, detail, editors, applications/applicants, saved/mine and empty states; include narrow widths, enlarged text, dark/light palettes and reduced motion. Confirm the real Maps picker and platform share/contact/booking launches on device. The applications endpoint is currently unpaginated; this pass preserves that API behavior. The shared application/filter sheet remains `WorkspaceForm`, owned elsewhere; its internals were not changed.
