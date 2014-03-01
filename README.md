draughtsjs
==========

This is a Draughts, also know as Checkers or Damas, game entire made with Javascript, HTML and CSS.

Demo Page: http://gartz.github.io/draughtsjs/

Features
--------

 - You can instance more then one game in the same page
 - You can use the events, to bind games, create a remote server, a console text with moves or dashboard
 - There is a demo with audio using `piecemove` event to play it.
 - You can settup the a map of the board with the pieces in desired fields, to create chalanges or resume games
 - It's possible to chose between every possible rule combining the isntance options (if forced attack are disabled you will need to add an way to the user stop attacking if he begins an attack, leaving a option to change the turn)
 - Drag'n'drop are supported
 - Spatial Navigation are supported
 - Tab Navigation are supported
 - Click support are supported
 - Almost mobile browsers are supported

Goals
-----

 - No external libs
 - One logic file
 - Compatible with IE8+ and modern browsers

History
-------

This was party of a seletive process from a Brazilian company, the first deploy was made in 2 days, then 
the second deploy took more 3 days. Both are working 1 day before the limit date, the first release contains only one way to play.

Future
------

 - Optimize the code
 - Make a better strategy for events/methods in the game
 - Add export to map feature
 - Destroy method, that cleanup the defaults (custom or not) event listeners
 - Animation when clicking to move the piece in the board
 - Optimize the Spatial Navigation support
 - Add option to change the turn when forcedAttack is disabled

Probably I will make a version with Web Components in the future that is only compatible with brand new 
modern browsers.

Author
------

Gabriel Reitz Giannattasio (gabriel@gartz.com.br)

You can fork this project and do anything you want with it, but please keep the credits.
