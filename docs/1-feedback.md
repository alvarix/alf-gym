# 05/14/26

### key
scope = this session only, edit template etc
! priority
!! high priority
? question

## Claude dev feedback:
E1.3, 1.4, F
- [ ] fine for now, but add this as low priority to new planning doc: this should be the exercise type to search excercise - as it should be anytime we are adding or editing and excercise.
    Number all old planning docs, with this new one last

## Session (app usage) Feedback
- [ ] ! add field for Exercise cues
- [ ] !! disable mobile ZOOM
- [ ] ! exercise mobile UI: inputs suck
- [ ] !! Prefills 
	- [ ] last workout stats as placeholder
	- [ ] if checkbox, they become record
	- [ ] if info added, check boxed
		- [ ] next set placeholders updated
- [ ] UI
	- [ ] remove
		- [ ] same as last set
		- [ ] input indicating which side
		- [ ] prescribed (after placeholder updates from last session)
	- [ ] swap position of reps and load
	- [ ] ability to delete block and exercise
		- [ ] scope choices
- [ ] add app icon 
	- [ ] change to green
- [ ] Progress Bar
- [ ] Mobile UI
	- [ ] stack header buttons
- [ ] Add new block
	- [ ] after checking scope etc, retain options in block to change mind
- [ ] ! Post session report
	- [ ] Data dump emailed?
	- [ ] Human readable and CSV
		- [ ] critical because we are locked into unhuman readable json format
- [ ] !! CRITICAL BUG 
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
