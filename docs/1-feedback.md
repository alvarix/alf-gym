# 05/14/26

### key
scope = this session only, edit template etc
! priority
!! high priority
? question

## Claude dev feedback:
E1.3, 1.4, F
- [x] fine for now, but add this as low priority to new planning doc: this should be the exercise type to search excercise - as it should be anytime we are adding or editing and excercise.
    (Every exercise input in builder + session views uses a `list=` datalist — type-to-search ships everywhere.)
    Number all old planning docs, with this new one last

## Session (app usage) Feedback
- [x] ! add field for Exercise cues (r4.8)
- [x] !! disable mobile ZOOM (r4.8)
- [x] ! exercise mobile UI: inputs suck (r4.8 — number type, min-width)
- [x] !! Prefills (r4.8)
	- [x] last workout stats as placeholder
	- [x] if checkbox, they become record
	- [x] if info added, check boxed (auto-done on edit, `app.js:376`)
		- [x] next set placeholders updated (per-set prescribed split)
- [x] UI
	- [x] remove
		- [x] same as last set ("repeat last" removed, r4.8)
		- [x] input indicating which side (r4.8)
		- [x] prescribed (after placeholder updates from last session) (r4.8)
	- [x] swap position of reps and load (r4.8)
	- [x] ability to delete block and exercise (in-session) — `openSessionRemove` w/ scope picker
		- [x] scope choices
- [x] add app icon (819a65c)
	- [x] change to green (icon.svg fill #37932f)
- [x] Progress Bar (r4.10)
- [x] Mobile UI
	- [x] stack header buttons (r4.10)
- [x] Add new block
	- [x] after checking scope etc, retain options in block to change mind (r4.10)
- [x] ! Post session report
	- [x] Data dump emailed (r4.10 — mailto:)
	- [x] Human readable and CSV (51d01db)
		- [x] critical because we are locked into unhuman readable json format
- [x] !! CRITICAL BUG (r4.7 — Alpine `'after'` error from duplicate group keys; openSession double-fire guard)
	- mid session all the UI dissappeared except, end session
	- after ending session, when I opened the archived session there was no UI
	- details: after 1.5h I found the app screen said 'end session' with no way to cancel. I thought i had mistakenly hit the end sessoin button and this was the UI that needed a cancel button. I expected to end teh session and see all the data on the archive page, but it wasnt there either.
	  I see view only label, date and title header, and 'Where you are'
	- in backup clicking copy to clipboad, there is no paste
	- downloaded json to data/  
	  comparing it to the backup prework:
	  3087 lines vs 4015 lines
	  the json is too inscrutible to be sure, but it appears to have data from the workout
	- no change after closing and reopening pwa, though other sessions do appear normally.
