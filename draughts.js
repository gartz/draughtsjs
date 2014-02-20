/*global CustomEvent, MouseEvent, HTMLDocument*/
(function () {
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }
            
            var aArgs = Array.prototype.slice.call(arguments, 1), 
                fToBind = this, 
                fNOP = function () {},
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP && oThis
                            ? this
                            : oThis,
                            aArgs.concat(Array.prototype.slice.call(arguments)));
                };
            
            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();
            
            return fBound;
        };
    }

    if (Element.prototype.addEventListener || !Object.defineProperty) {
        return;
    }
    
    // create an MS event object and get prototype
    var proto = document.createEventObject().constructor.prototype;
    
    Object.defineProperty(proto, 'target', {
        get: function() { return this.srcElement; }
    });
    
    // IE8 addEventLister shim
    var addEventListenerFunc = function(type, handler) {

        var fn = handler;
        
        if (!('on' + type in this)) {
            this.__elemetIEid = this.__elemetIEid || '__ie__' + Math.random();
            var customEventId = type + this.__elemetIEid;
            document.documentElement[customEventId];
            var element = this;
            
            document.documentElement.attachEvent('onpropertychange', 
            function (event) {
                
                // if the property changed is the custom jqmReady property
                if (event.propertyName === customEventId) {
                    fn.call(element, document.documentElement[customEventId]);
                }
            });
            return;
        }
    
        this.attachEvent('on' + type, fn.bind(this));
    };
    
    // setup the DOM and window objects
    HTMLDocument.prototype.addEventListener = addEventListenerFunc;
    Element.prototype.addEventListener = addEventListenerFunc;
    window.addEventListener = addEventListenerFunc;
    
    CustomEvent = function (type, obj) {
        obj = obj || {};
        obj.name = type;
        obj.customEvent = true;
        return obj;
    };
    
    MouseEvent = function (type, obj) {
        var event = document.createEventObject();
        event.type = 'on' + type;
        for (var prop in obj) {
            event[prop] = obj[prop];
        }
        return event;
    };
    
    var dispatchEventFunc = function (e) {
        if (!e.customEvent) {
            this.fireEvent(e.type, e);
            return;
        }
        // no event registred
        if (!this.__elemetIEid) {
            return;
        }
        var customEventId = e.name + this.__elemetIEid;
        document.documentElement[customEventId] = e;
    };
    
    // setup the Element dispatchEvent used to trigger events on the board
    Element.prototype.dispatchEvent = dispatchEventFunc;
})();

// modern browser support forEach, probably will be IE8
var modernBrowser = 'forEach' in Array.prototype;

// IE8 pollyfills:
// IE8 slice doesn't work with NodeList
if (!modernBrowser) {
    var builtinSlice = Array.prototype.slice;
    Array.prototype.slice = function(action, that) {
        'use strict';
        var arr = [];
        for (var i = 0, n = this.length; i < n; i++)
            if (i in this)
                arr.push(this[i]);
                
        return builtinSlice.apply(arr, arguments);
    };
}
if (!('forEach' in Array.prototype)) {
    Array.prototype.forEach = function(action, that) {
        'use strict';
        for (var i = 0, n = this.length; i < n; i++)
            if (i in this)
                action.call(that, this[i], i);
    };
}
if (typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, ''); 
    };
}
if (!Array.prototype.filter) {
    Array.prototype.filter = function(fun /*, thisArg */) {
        'use strict';
        
        if (this === void 0 || this === null)
            throw new TypeError();
        
        var t = Object(this);
        var len = t.length >>> 0;
        if (typeof fun != 'function')
            throw new TypeError();
        
        var res = [];
        var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
        for (var i = 0; i < len; i++) {
            if (i in t) {
                var val = t[i];
                
                // NOTE: Technically this should Object.defineProperty at
                //       the next index, as push can be affected by
                //       properties on Object.prototype and Array.prototype.
                //       But that method's new, and collisions should be
                //       rare, so use the more-compatible alternative.
                if (fun.call(thisArg, val, i, t)) res.push(val);
            }
        }
        
        return res;
    };
}
(function () {

    // Helpers
    
    function removeClass(el, className) {
        // Remove a className, IE8 doesn't support classList :(
        
        el.className = el.className.replace(className, '').trim();
    }
    
    function queryField(line, column) {
        // Help mount a querySelector to find a field
        
        return 'div.line' + line + '.column' + column;
    }
    
    function closestClassMatchElement(element, match) {
        // Match closest element with match param
        
        var el = element;
        while(el.className.match(match) === null && el.parentElement) {
            el = el.parentElement;
        }
        return el;
    }
    
    function closestPieceElement(element) {
        // find the piece element on parent elements
        
        return closestClassMatchElement(element, /player([0-9])/i);
    }

    function DraughtsBoard(opt) {
        // Data from a DraughtsBoard element
        //
        // Options:
        //
        // - size
        //     Is the number of field to be added in the x and y axis of the
        //     board
        // - turn
        //     Begin the game in a specifc turn (use map + turn to restore a
        //     game)
        // - element
        //     HTMLElement, when there isn't a element, the board will create
        //     one
        // - forceAttack
        //     When you force attack, the if attack is possible the player need
        //     to execute an attack
        // - forceHoldPiece
        //     After click to hold a piece, the player can't change his mind,
        //     it will need to play with it
        // - map
        //     Array map with the player pieces of the board, where 
        //     - 0 = empty
        //     - 1 = player 1 piece
        //     - 2 = player 2 piece
        //     - 3 = player 1 queen piece
        //     - 4 = player 2 queen piece
        //     Example:
        //     [
        //         [3,0,1,0,1,0],
        //         [0,1,0,1,0,1],
        //         [0,0,0,0,0,0],
        //         [0,2,0,2,0,2],
        //         [4,0,2,0,2,0]
        //     ]
        //     
        // Events:
        //
        // - changeturn
        //     Dispatch when change the turn value
        // - destroyboard
        //     Dispatch when the board is destroyed (every field is removed)
        // - addedfield
        //     Dispatch when the field is appended to the board element
        
        // Ensure options object
        if (typeof opt !== 'object') {
            opt = {};
        }
        
        // Setup the HTMLElement to be the board
        this.element = opt.element || document.createElement('div');
        
        // Only because IE8 doesn't support Object.defineProperty I need to
        // substitute the previous div, if already has size defined for a new
        // one or the defineProperty wont work as expected
        if (this.element.size) {
            var parentEl = this.element.parentElement;
            var oldEl = this.element;
            this.element = document.createElement('div');
            this.element.id = oldEl.id;
            this.element.className = oldEl.className;
            if (parentEl) {
                parentEl.insertBefore(this.element, oldEl);
                parentEl.removeChild(oldEl);
            }
            
        }
        
        this.element.data = this;
        
        // Set default board size to 8 if is a invalid value
        var size = !isNaN(opt.size) && (+ opt.size) % 2 === 0 ? + opt.size : 8;
        if (size < 5) {
            throw new Error('Board size must be greater then 5');
        }
        
        // Constants or get/set need to be in the element because of IE8
        
        // Size is a constant from the board
        Object.defineProperty(this.element, 'size', {
            get: function () {
                return size;
            }
        });
        
        // Set default value to forceAttack as true
        var forceAttack = opt.forceAttack !== false;
        
        // ForceAttack is a constant from the board
        Object.defineProperty(this.element, 'forceAttack', {
            get: function () {
                return forceAttack;
            }
        });
        
        // Set default value to forcePieceHold as false
        var forcePieceHold = opt.forcePieceHold === true;
        
        // ForceAttack is a constant from the board
        Object.defineProperty(this.element, 'forcePieceHold', {
            get: function () {
                return forcePieceHold;
            }
        });
        
        // Set default value to allowBackwardAttack as false
        var allowBackwardAttack = opt.allowBackwardAttack === true;
        
        // ForceAttack is a constant from the board
        Object.defineProperty(this.element, 'allowBackwardAttack', {
            get: function () {
                return allowBackwardAttack;
            }
        });
        
        // Number of turns played
        var turn = Number(opt.turn) || 0;
        Object.defineProperty(this.element, 'turn', {
            get: function () {
                return turn;
            },
            set: function (val) {
                if (isNaN(val)) throw new Error('Invalid turn');
                var old = turn;
                turn = + val;
    
                // It's useful old value from turn to validate if you jump over
                // turns for future online features
                var event = new CustomEvent('changeturn', { 'detail': {
                    oldValue: old,
                    value: turn
                }});
    
                // trigger draughts
                this.dispatchEvent(event);
            }
        });
        
        // setup the game map
        if (opt.map instanceof Array) {
            this.element.map = opt.map;
        }
        
        // Default triggers
        this.element.addEventListener('addedfield', function (event) {
            // When a field is added to the board, setup it 
            
            // no default? just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var pos = event.detail.position;
            var fieldEl = event.detail.field.element;
            var s = 100 / this.size;
            
            // Set the field size idependent of CSS, allow any size board
            var style = 'width: ' + s + '%;height: ' + s + '%;';
            fieldEl.setAttribute('style', style);
            
            // Check if the field need to be disabled (white color)
            if (!(pos % 2 === (pos / this.size << 0) % 2)) {
                fieldEl.className = 'white';
                return;
            }
            
            event = new CustomEvent('addpiece', {
                'detail': event.detail
            });
    
            // Each field dispatch a addedfield event
            this.dispatchEvent(event);
        });
        
        this.element.addEventListener('addpiece', function (event) {
            // When a field is added to the board, append the player piece 
            
            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var position = event.detail.position;
            var piece;
            
            if (!this.map) {
                // Create a new game from the default start
                if (position < (this.size * this.size / 2) - this.size) {
                    piece = new DraughtsPiece({
                        player: 0
                    });
                }
                
                if (position >= (this.size * this.size / 2) + this.size) {
                    piece = new DraughtsPiece({
                        player: 1
                    });
                }
                
            } else {
                var rule = this.map[event.detail.line]
                if (!rule) {
                    return;
                }
                rule = rule[event.detail.column];
                if (!rule) {
                    return;
                }
                if (rule > 0 && rule < 3) {
                    piece = new DraughtsPiece({
                        player: (rule % 2) ^ 1
                    });
                } else {
                    piece = new DraughtsPieceQueen({
                        player: (rule % 2) ^ 1
                    });
                }
            }
            
            if (piece) {
                event.detail.field.element.appendChild(piece.element);
                piece.board = this;
            }
            
        });
        
        this.element.addEventListener('created', function (event) {
            // When a finish creating the board, change the turn to 1
    
            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
    
            this.turn++;
        });
        
        this.element.addEventListener('changeturn', function (event) {
            // When change a turn, re-calculate the possible moves
    
            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
    
            var player = event.detail.value % 2 ^ 1;
            
            this.data.removeAllMasks();
            
            // Select other player pieces (IE8 not support attr selector)
            var pieces = this.data.playerPieces(player ^ 1);
            
            // Remove href and focus from other player pieces
            pieces.forEach(function (piece) {
                piece.data.denyMove();
            });
            
            // Select current player pieces
            pieces = this.data.playerPieces(player);
            
            // Store allowed attacks and moves
            var attacks = [];
            var moves = [];
            
            // Check for allowed moviments
            pieces.forEach(function (piece) {
                if (piece.data.allowedAttacks().length > 0) {
                    attacks.push(piece);
                }
                if (piece.data.allowedMoves().length > 0) {
                    moves.push(piece);
                }
            });
            
            if (attacks.length > 0) {
                attacks.forEach(function (piece) {
                    piece.data.allowMove();
                });
                // When forcing attacks it must not hit the default moves
                if (this.forceAttack) {
                    return;
                }
            }
            
            if (moves.length > 0) {
                moves.forEach(function (piece) {
                    piece.data.allowMove();
                });
            }
        });
        
        this.element.addEventListener('mousedown', function (event) {
            // Focus the piece when click on it (when it's possible)

            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var piece = closestPieceElement(event.target || event.srcElement);
            piece.focus();
        });
        
        function pieceHoldDispatcher(event) {
            // If clicking in a piece, dipatch piecehold if is possible

            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var piece = closestPieceElement(event.target || event.srcElement);
            
            if (!piece || !piece.parentElement) {
                return;
            }
            
            if (!piece.getAttribute('href')) {
                return;
            }
            
            // Trigger a piece hold event
            var event = new CustomEvent('piecehold', { 'detail': {
                piece: piece,
                field: piece.parentElement
            }});

            // trigger draughts
            this.dispatchEvent(event);
        }
        
        // Event in mousedown because user can start clicking in the element
        // but move the mouse and mouseup in other element, this ensure to
        // focus the right element
        this.element.addEventListener('mousedown', pieceHoldDispatcher);
        // Click is for click and when you keydown enter key, it dispatch click
        this.element.addEventListener('click', pieceHoldDispatcher);
        
        this.element.addEventListener('click', function (event) {
            // If clicking in a mask, dipatch piecerelease if is holding a piece

            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            event.target = event.target || event.srcElement;
            var mask = closestClassMatchElement(event.target, /move/i);
            if (!mask || !mask.parentElement) {
                return;
            }
            
            var piece = this.querySelector('a.focus');
            if (!piece) {
                return;
            }
            
            var field = mask.parentElement;
            
            // Trigger a piece hold event
            var event = new CustomEvent('piecerelease', { 'detail': {
                piece: piece,
                destine: field,
                mask: mask
            }});

            // trigger draughts
            this.dispatchEvent(event);
        });
        
        var holding;
        this.element.addEventListener('piecehold', function (event) {
            // Hold the piece to be able to move it in the board, will add the
            // possible moves and attacks masks in the field
            
            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var piece = event.detail.piece;
            
            // Check if can change the holding piece
            if (this.forcePieceHold) {
                if (holding) {
                    return;
                }
                holding = true;
                
                var pieces = this.data.playerPieces(piece.data.player());
            
                // Remove href and focus from other player pieces
                pieces.forEach(function (piece) {
                    if (event.detail.piece === piece) {
                        return;
                    }
                    piece.data.denyMove();
                });
            }
            
            // workaround for IE8 focus
            var selectedFields = this.querySelectorAll('a.focus');
            Array.prototype.slice.call(selectedFields).forEach(function (el) {
                removeClass(el, 'focus');
            });
            
            piece.className += ' focus';
            piece.focus();
            
            this.data.removeAllMasks();
            
            var attacks = piece.data.allowedAttacks();
            if (attacks.length > 0) {
                // add masks to allowed attacks fields
                attacks.forEach(function (attack) {
                    attack.field.data.addMask({
                        attack: attack.opponent
                    });
                });

                // Attack is possible and forcing so don't let other moves
                if (this.forceAttack) {
                    return;
                }
            }
            
            var moves = piece.data.allowedMoves();
            if (moves.length > 0) {
                moves.forEach(function (field) {
                    field.data.addMask();
                });
            }
        });
        
        this.element.addEventListener('piecerelease', function (event) {
            // Release piece in some field mask, do the action (move or attack)
            
            // no default just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            var piece = event.detail.piece;
            
            holding = false;
            
            this.data.removeAllMasks();
            
            piece.data.moveTo(event.detail.destine, event.detail.mask);
        });
        
        this.element.addEventListener('piecemove', function (event) {
            // When the move is an attack dispatch a attack event and check if 
            // can still attacking with the same piece, if so, then avoid 
            // changeTurn

            var piece = event.detail.piece;
            var mask = event.detail.mask;
            var toField = event.detail.toField;
            var fromField = event.detail.fromField;
            
            // mask has opponent details?
            if (!mask.data.opponent.length === 0) {
                return;
            }
            
            var isAttack;
            mask.data.opponent.forEach(function (opponent) {
                // Attack the opponent
                
                piece.data.attack(opponent, fromField, toField);
                isAttack = true;
            });
            
            if (!isAttack) {
                return;
            }
            
            piece.data.attacks++;
            var attacks = piece.data.allowedAttacks();
            
            if (attacks.length > 0) {
                event.detail.changeTurn = false;
            }

            // Remove href and focus from other pieces
            this.data.playerPieces(piece.data.player()).forEach(function (p) {
                if (piece === p) {
                    return;
                }
                p.data.denyMove();
            })
            
            // This will help to show what is your new allowed moves
            var clickEvent = new MouseEvent('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true,
                'target': piece
            });
            
            piece.dispatchEvent(clickEvent);
        });
        
        // Create the board
        this.create();
    }
    
    DraughtsBoard.prototype = {
        // no Object.observer... No problem! Let's use the element to have event
        // listeners
        addEventListener: function () {
            // Bind addEventListener
    
            this.element.addEventListener.apply(this.element, arguments);
        },
        dispatchEvent: function () {
            // Bind dispatchEvent
    
            this.element.dispatchEvent.apply(this.element, arguments);
        },
        size: function () {
            // Bind dispatchEvent
    
            return this.element.size;
        },
        destroy: function () {
            // Remove all childrens from the board
    
            while (this.element.children.length > 0) {
                this.element.removeChild(this.element.children[0]);
            }
            
            var event = new CustomEvent('destroyboard');
    
            // trigger draughts
            this.element.dispatchEvent(event);
        },
        create: function () {
            // Create the board based on the options passed
            
            // Before create remove all childrens
            if (this.element.children.length > 0) {
                this.destroy();
            }
            
            var size = this.size();
            var event;
            
            for (var i = 0; i < size * size; i++) {
                var field = new DraughtsBoardField(i / size << 0, i % size);
                
                // Append field element as board element children
                this.element.appendChild(field.element);
                
                event = new CustomEvent('addedfield', {
                    'detail': {
                        field: field,
                        position: i,
                        line: field.line,
                        column: field.column
                    }
                });
    
                // Each field dispatch a addedfield event
                this.element.dispatchEvent(event);
            }
            
            event = new CustomEvent('created');
    
            // After create all fields dispatch created
            this.element.dispatchEvent(event);
        },
        removeAllMasks: function () {
            // Remove all masks in the board
            
            var mask = this.element.querySelectorAll('a.move');
            Array.prototype.slice.call(mask).forEach(function (mask) {
                // Ensure it's on DOM
                if (mask.parentElement) {
                    // And remove it...
                    mask.parentElement.removeChild(mask);
                }
            });
        },
        playerPieces: function(id) {
            var pieces = this.element.querySelectorAll('a.player' + id);
            return Array.prototype.slice.call(pieces);
        },
        map: function () {
            // Export the game pieces positions to a array map
            // 0: empty field
            // 1: player1 piece
            // 2: player2 piece
            // 3: player1 queen
            // 4: player2 queen
            var map = [];
            //TODO: for in board, each line is a new array
            
            return map;
        }
    };
    
    function DraughtsBoardField(line, column) {
        // Data from a Field element of a DraughtsBoard
        
        var field = document.createElement('div');
        this.element = field;
        field.data = this;
        
        this.line = line;
        this.column = column;
        
        // Add class to the field, let search using querySelector
        // ... not using dataset because of IE8
        field.className += ' line' + line;
        field.className += ' column' + column;
    }
    
    DraughtsBoardField.prototype = {
        addMask: function (opt) {
            // Create and append a mask that allow focus, click or dragevent
            // options:
            //  - attack: piece element or array of piece elements
            
            var mask = document.createElement('a');
            mask.className = 'move';
            mask.setAttribute('href', 'javascript: ');
            
            opt = opt || {};
            mask.data = {
                opponent: []
            };
            
            // Register attacked pieces in the mask
            if (opt.attack) {
                if (opt.attack instanceof Array) {
                    mask.data.opponent.merge(opt.attack);
                } else {
                    mask.data.opponent.push(opt.attack);
                }
            }
            
            this.element.appendChild(mask);
        },
        removeMask: function () {
            // Remove the mask from the field

            var mask = this.element.querySelector('a.move');
            if (!mask) {
                return;
            }
            this.element.removeChild(mask);
        }
    };
    
    function DraughtsPiece(opt) {
        // Player piece constructor
        
        // Some rules allow reverse attacke after first attack even when you aren't
        // a queen piece, here you can calculate what attack turn is it.
        this.attackTurn = 0;
        
        // piece element
        this.element = document.createElement('a');
        this.element.data = this;
        
        // Inside div for design
        var div = document.createElement('div');
        div.appendChild(document.createElement('div'));
        this.element.appendChild(div);
        
        // Setup the player class
        if (!opt.player) {
            this.element.className += ' player0';
        } else {
            this.element.className += ' player1';
        }
        
        this.attacks = 0;
    }
    
    DraughtsPiece.prototype = {
        player: function () {
            // Return number from player id
            
            return + this.element.className.match(/player([0-9])/i)[1];
        },
        denyMove: function () {
            // Remove user interaction attributes for the piece
            
            this.element.removeAttribute('href');
            removeClass(this.element, 'focus');
        },
        allowMove: function () {
            // Add user interaction attributes for the piece
            
            // allow click, touch and spatial navigator
            this.element.setAttribute('href', 'javascript: ');
        },
        allowedMoves: function (field) {
            // Return array of fields allowed to this piece moveTo
            
            return this.findNextFields(field).filter(function (el) {
                return el.children.length === 0;
            });
        },
        allowedAttacks: function (field) {
            // Return a list of objects contain the destine field and opponent
            // piece
            
            var opponentId = this.player() ^ 1;
            
            var attacks = [];
            var isABK = this.board.allowBackwardAttack && this.attacks > 0;
            
            this.findNextFields(field, isABK).forEach(function (atkField) {
                var opponent = atkField.querySelector('a.player' + opponentId);
                
                if (!opponent) {
                    return;
                }
                
                var dir = isABK;
                if (isABK) {
                    var pieceField = this.element.parentElement.data.line;
                    // find direction
                    dir = !((pieceField > atkField.data.line) ^ opponentId);
                }
                
                this.findNextFields(atkField, dir).forEach(function (movField) {
                    if (movField.children.length !== 0) {
                        return;
                    }
                    attacks.push({
                        field: movField,
                        opponent: opponent
                    });
                });
            }.bind(this));
            
            return attacks;
        },
        findNextFields: function (field, backward) {
            // Check near field possible moves, if is the same as piece will

            var currentField = this.element.parentElement;
            field = field || currentField;
            var line = field.data.line;
            var column = field.data.column;
            
            var playerId = this.player();
            
            if (playerId === 0) {
                line++;
            } else {
                line--;
            }
            
            var query = [];
            
            if (field === currentField) {
                query.push(queryField(line, column - 1));
                query.push(queryField(line, column + 1));
            } else {
                if (currentField.data.column < column) {
                    query.push(queryField(line, column + 1));
                } else {
                    query.push(queryField(line, column - 1));
                }
            }
            if (backward) {
                if (playerId === 0) {
                    line -= 2;
                } else {
                    line += 2;
                }
                if (field === currentField) {
                    query.push(queryField(line, column - 1));
                    query.push(queryField(line, column + 1));
                } else {
                    query = [];
                    if (currentField.data.column < column) {
                        query.push(queryField(line, column + 1));
                    } else {
                        query.push(queryField(line, column - 1));
                    }
                }
            }

            var fields = this.board.querySelectorAll(query.join(','));
            return Array.prototype.slice.call(fields);
        },
        moveTo: function (field, mask) {
            // Move a piece in the board
            
            // Create a move event
            var event = new CustomEvent('piecemove', { 'detail': {
                piece: this.element,
                fromField: this.element.parentElement,
                toField: field,
                mask: mask,
                turn: this.board.turn,
                changeTurn: true
            }});
            
            field.appendChild(this.element);
            
            // trigger board
            this.board.dispatchEvent(event);
            if (event.detail.changeTurn) {
                // Change the player turn
                this.attacks = 0;
                this.board.turn++;
            }
        },
        attack: function (opponent, fromField, toField) {
            
            // Create a attack event
            var event = new CustomEvent('pieceattack', { 'detail': {
                piece: this.element,
                opponent: opponent,
                field: opponent.parentElement,
                fromField: fromField,
                toField: toField,
                turn: this.board.turn
            }});
            
            // trigger board
            this.board.dispatchEvent(event);
            
            // no default? just leave...
            if (event.defaultPrevented) {
                return;
            }
            
            // As default it removes the attacked oponent from the board
            if (opponent.parentElement) {
                opponent.parentElement.removeChild(opponent);
            }
        }
    };
    
    function DraughtsPieceQueen() {}
    
    function DraughtsPieceQueenPrototype() {
        this.allowedMoves = function () {
            
            return DraughtsPiece.prototype.allowedMoves.apply(this, arguments);
        };
        this.allowedAttacks = function () {
            
            return DraughtsPiece.prototype.allowedAttacks.apply(this, arguments);
        };
        this.moveTo = function (field) {
            
            return DraughtsPiece.prototype.moveTo.apply(this, arguments);
        };
        this.attack = function (opponent, field) {
            
            return DraughtsPiece.prototype.attack.apply(this, arguments);
        };
    }
    
    DraughtsPieceQueenPrototype.prototype = DraughtsPiece.prototype;
    DraughtsPieceQueen.prototype = new DraughtsPieceQueenPrototype();

    // Export to global
    var root = this;
    root.DraughtsBoard = DraughtsBoard;
})();

window.addEventListener('load', function () {
    //TODO: querySelectorAll -> forEach #draughts
    
    var draughts = document.querySelectorAll('#draughts')[1];
    
    var maps = {
        attacks: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 1, 0],
            [0, 0, 0, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 1, 0],
            [0, 0, 0, 2, 0, 0, 0, 0]
        ],
        twiceAttack: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 1, 0],
            [0, 0, 0, 2, 0, 2, 0, 0]
        ]
    };
    
    var opt = {
        element: draughts.querySelector('#board'),
        size: 8,
        turn: 1,
        map: maps.twiceAttack
    };
    
    var board = new DraughtsBoard(opt);
    
    function updateBoard() {
        opt.element = draughts.querySelector('#board');
        opt.size = draughts.querySelector('#size').value;
        opt.forceAttack = draughts.querySelector('#forceattack').checked;
        opt.forcePieceHold = draughts.querySelector('#forcehold').checked;
        opt.allowBackwardAttack = draughts.querySelector('#backwardattack').checked;
        board = new DraughtsBoard(opt);
    }
    
    draughts.querySelector('#size').addEventListener('change', updateBoard);
    draughts.querySelector('#forceattack').addEventListener('change', updateBoard);
    draughts.querySelector('#forcehold').addEventListener('change', updateBoard);
    draughts.querySelector('#backwardattack').addEventListener('change', updateBoard);
    
});

window.addEventListener('load', function () {
    // Load with hash 8 for a 8x8 board or 10 for 10x10 international board
    var BOARD_SIZE = + window.location.hash.split('#')[1] || 8;
    
    // Game turns
    var turn = 0;
    
    var draughts = document.querySelector('#draughts');
    // Select the board
    var board = draughts.querySelector('#board');
    board.className = 'size' + BOARD_SIZE;
    
    // Create the elements and add to the board
    for (var i = 0; i < BOARD_SIZE*BOARD_SIZE; i++) {
        var field = document.createElement('div');
        field.detail = field.detail || {};
        field.detail.column = i % BOARD_SIZE;
        field.detail.line = i / BOARD_SIZE << 0;
        
        // Using class make a shortcut because IE9- doesn't support dataset
        field.className += ' column' + field.detail.column;
        field.className += ' line' + field.detail.line;
        
        var dash0 = draughts.querySelector('#dash .player0 .captured');
        var dash1 = draughts.querySelector('#dash .player1 .captured');

        // Add the pieces
        if (i % 2 === (i / BOARD_SIZE << 0) % 2) {
            
            var piece = document.createElement('a');
            var pieceBorder = document.createElement('div');
            pieceBorder.appendChild(document.createElement('div'));
            piece.appendChild(pieceBorder);
            
            // player 1 pieces on the black fields
            if (i < (BOARD_SIZE * BOARD_SIZE / 2) - BOARD_SIZE) {
                piece.className += ' player0';
                field.appendChild(piece);
                if (dash0) {
                    dash0.appendChild(document.createElement('div'));
                }
            
            // player 2 pieces on the black fields
            } else if (i >= (BOARD_SIZE * BOARD_SIZE / 2) + BOARD_SIZE) {
                piece.className += ' player1';
                field.appendChild(piece);
                if (dash1) {
                    dash1.appendChild(document.createElement('div'));
                }
            }
        } else {
            field.className = 'disabled';
        }
        
        board.appendChild(field);
        
        // Begin the game
        changeTurn();
    }
    
    function removeClass(el, className) {
        // Remove a className, IE8 doesn't support classList :(
        el.className = el.className.replace(className, '').trim();
    }
    
    function changeTurn() {
        turn++;
        
        var id = turn % 2;
        
        // Remove unalowed player href
        var query = 'a.player' + (id ^ 1);
        var oldEls = Array.prototype.slice.call(board.querySelectorAll(query));
        
        oldEls.forEach(function (el) {
            el.removeAttribute('href');
            removeClass(el, 'focus');
        });
        
        query = 'a.player' + id;
        var els = Array.prototype.slice.call(board.querySelectorAll(query));
        
        var attacking;
        
        // Check if can attack
        els.forEach(function (el) {
            var possibleAttacks = piecePossibleAttackMovies(el);
            if (possibleAttacks.length > 0) {
                attacking = true;
                el.setAttribute('href', 'javascript: ');
            }
        });
        
        // Prevent from moving other pieces when attack is possible
        if (attacking) {
            return;
        }
        
        // Filter to remove the elements without possible moves
        els = els.filter(function (el) {
            if (piecePossibleMoves(el).length > 0) {
                el.setAttribute('href', 'javascript: ');
                return true;
            }
        });
        
        // There is no elements with possible moves, gameover.
        if (els.length === 0) {
            // No more moves, the other player win.
            
            var gameoverEvent = new CustomEvent('gameover', { 'detail': {
                winner: oldEls[0],
                losser: piece,
                motive: 'no_more_moves',
                turn: turn - 1
            }});
            
            // trigger draughts
            draughts.dispatchEvent(gameoverEvent);
        }
    }
    
    function piecePlayerId(element) {
        return + element.className.match(/player([0-9])/i)[1];
    }
    
    function queenNextMove(element, field, attack) {
        // This function discovery and return the element from next possible
        // move for the queen piece
        
        if (!field) {
            return;
        }
        
        var pieceField = element.parentElement;
        
        var nextLine = field.detail.line;
        if (pieceField.detail.line < field.detail.line) {
            nextLine++;
        } else {
            nextLine--;
        }

        var nextColumn = field.detail.column;
        if (pieceField.detail.column < field.detail.column) {
            nextColumn++;
        } else {
            nextColumn--;
        }
        var nextFieldSelector = queryField(nextLine, nextColumn);
        var nextField = board.querySelector(nextFieldSelector);
        if (!nextField) {
            return;
        }
        if (!attack && nextField.children.length > 0) {
            return;
        }
        
        return nextField;
    }
    
    function queenPossibleMoves(element) {
        // Pass a queen piece element, and it will return a array containing 
        // elements that allow this element moving
        
        var field = element.parentElement;
        var line = field.detail.line;
        var column = field.detail.column;
        
        var query = queryField(line - 1, column - 1);
        query += ',' + queryField(line - 1, column + 1);
        query += ',' + queryField(line + 1, column - 1);
        query += ',' + queryField(line + 1, column + 1);
        
        
        var els = Array.prototype.slice.call(board.querySelectorAll(query));
        els = els.filter(function (el) {
            return el.children.length === 0;
        });
        
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var nextField = queenNextMove(element, el);
            if (nextField) {
                els.push(nextField);
            }
        }
        
        return els;
    }
    
    function piecePossibleMoves(element) {
        // Pass a piece element, and it will return a array containing elements
        // that allow this element moving
        
        if (element.className.indexOf('queen') !== -1) {
            return queenPossibleMoves(element);
        }
        
        var field = element.parentElement;
        var line = field.detail.line;
        var column = field.detail.column;
        
        // Player0 will walk down, Player1 will walk up
        var playerId = piecePlayerId(element);
        if (playerId === 0) {
            line++;
        } else {
            line--;
        }
        
        // Select next field at left without piece
        var query = queryField(line, column - 1);
        query += (modernBrowser) ? ':empty' : '';
        // Select next field at right without piece
        query += ',' + queryField(line, column + 1);
        query += (modernBrowser) ? ':empty' : '';
        
        // IE8 doesn't support :empty, so I need to ensure it's empty
        if (modernBrowser) {
            return Array.prototype.slice.call(board.querySelectorAll(query));
        }
        var els = Array.prototype.slice.call(board.querySelectorAll(query));
        return els.filter(function (el) {
            return el.children.length === 0;
        });
    }
    
    function queryField(line, column) {
        return 'div.line' + line + '.column' + column;
    }

    function queenPossibleMovesAttacks(element) {
        
        // cleanup old attack query
        element.detail = {};
        
        var els = queenPossibleMoves(element);
        var id = piecePlayerId(element);
        
        var moves = [];
        
        els.forEach(function (el) {
            var enemyField = queenNextMove(element, el, true);
            if (!enemyField) {
                return;
            }
            var enemy = enemyField.querySelector('a.player' + (id ^ 1));
            if (!enemy) {
                return;
            }
            var field = queenNextMove(element, enemyField);
            if (!field) {
                return;
            }
            moves.push(field);
            var fieldSelector = queryField(field.detail.line, field.detail.column);
            element.detail[fieldSelector] = enemy;
        });
        
        var field = element.parentElement;
        var line = field.detail.line;
        var column = field.detail.column;
        
        var query = queryField(line - 1, column - 1);
        query += ',' + queryField(line - 1, column + 1);
        query += ',' + queryField(line + 1, column - 1);
        query += ',' + queryField(line + 1, column + 1);
        
        els = Array.prototype.slice.call(board.querySelectorAll(query));
        els = els.forEach(function (el) {
            if (el.children.length === 0) {
                return;
            }
            var enemy = el.querySelector('a.player' + (id ^ 1));
            if (!enemy) {
                return;
            }
            var field = queenNextMove(element, el, true);
            if (!field || field.querySelector('a')) {
                return;
            }
            moves.push(field);
            var fieldSelector = queryField(field.detail.line, field.detail.column);
            element.detail[fieldSelector] = enemy;
        });
        
        return moves;
    }
    
    function piecePossibleAttackMovies(element) {
        // Return a array with fields that are possible to move when attacking
        
        if (element.className.indexOf('queen') !== -1) {
            return queenPossibleMovesAttacks(element);
        }
        
        // cleanup old attack query
        element.detail = {};
        
        var field = element.parentElement;
        var line = field.detail.line;
        var column = field.detail.column;
        
        // Player0 will walk down, Player1 will walk up
        var playerId = piecePlayerId(element);
        if (playerId === 0) {
            line++;
        } else {
            line--;
        }
        
        // Select next field at left without piece
        var query = queryField(line, column - 1);
        // Select next field at right without piece
        query += ',' + queryField(line, column + 1);
        
        var els = Array.prototype.slice.call(board.querySelectorAll(query));
        var moves = [];
        els.forEach(function (el) {
            if (el.children.length === 0) {
                return;
            }
            var enemy = el.querySelector('.player' + (playerId ^ 1));
            if (!enemy) {
                return;
            }
            var nextLine = line;
            if (playerId === 0) {
                nextLine++;
            } else {
                nextLine--;
            }
            var nextColumn = enemy.parentElement.detail.column;
            if (enemy.parentElement.detail.column > field.detail.column) {
                nextColumn++;
            } else {
                nextColumn--;
            }
            var nextFieldSelector = queryField(nextLine, nextColumn);
            var nextField = board.querySelector(nextFieldSelector);
            if (!nextField) {
                return;
            }
            if (nextField.children.length > 0) {
                return;
            }
            element.detail[nextFieldSelector] = enemy;
            moves.push(nextField);
        });
        
        return moves;
    }
    
    function closestClassMatchElement(element, match) {
        // Match closest element with match param
        
        var el = element;
        while(el.className.match(match) === null && el.parentElement) {
            el = el.parentElement;
        }
        return el;
    }
    
    function closestPieceElement(element) {
        // find the piece element on parent elements
        
        return closestClassMatchElement(element, /player([0-9])/i);
    }
    
    // Focus the piece when click on it (when it's possible)
    board.addEventListener('mousedown', function (event) {
        var piece = closestPieceElement(event.target || event.srcElement);
        piece.focus();
    });
    
    function removeMoveMasks() {
        var selectedFields = board.querySelectorAll('a.move');
        Array.prototype.slice.call(selectedFields).forEach(function (el) {
            if (el.parentElement) {
                el.parentElement.removeChild(el);
            }
        });
    }
    
    function addMoveMasks(elements) {
        if (!(elements instanceof Array)) {
            elements = [elements];
        }
        elements.forEach(function (el) {
            var allowMoveMask = document.createElement('a');
            allowMoveMask.className = 'move';
            allowMoveMask.setAttribute('href', 'javascript: ');
            el.appendChild(allowMoveMask);
        });
    }
    
    board.addEventListener('click', function (event) {
        event.target = event.target || event.srcElement;
        var piece = closestPieceElement(event.target);
        if (!piece || !piece.parentElement) {
            return;
        }
        
        if (!piece.getAttribute('href')) {
            return;
        }
        
        // workaround for IE8 focus
        var selectedFields = board.querySelectorAll('a.focus');
        Array.prototype.slice.call(selectedFields).forEach(function (el) {
            removeClass(el, 'focus');
        });
        piece.className += ' focus';
        piece.focus();
        
        // Remove all move masks in the board
        removeMoveMasks();
        
        var possibleAttacks = piecePossibleAttackMovies(piece);
        if (possibleAttacks.length > 0) {
            // Need to attack someone
            
            addMoveMasks(possibleAttacks);
            return;
        }
        
        addMoveMasks(piecePossibleMoves(piece));
    });
    
    function pieceToDash(piece) {
        // Move a piece to the opponent dash

        if (!piece) {
            return;
        }
        // get opponent id
        var id = piecePlayerId(piece) ^ 1;
        
        // would be way easier if IE8 supports :empty...
        var query = '#dash .player' + id + '  .captured > div';
        var dash = draughts.querySelectorAll(query);
        
        if (dash.length === 0) {
            return;
        }
        // I could use some... or make a shim for IE8... but
        for (var i = 0; i < dash.length; i++) {
            if (dash[i].children.length === 0) {
                dash[i].appendChild(piece);
                return;
            }
        }
        
    }
    
    function movePiece(piece, destine) {
        // Move a piece in the board
        
        // Create a move event
        var event = new CustomEvent('piecemove', { 'detail': {
            piece: piece,
            from: piece.parentElement,
            to: destine,
            turn: turn,
            changeTurn: true
        }});
        
        destine.appendChild(piece);
        
        // Remove all move masks in the board
        removeMoveMasks();
        
        // trigger board
        board.dispatchEvent(event);
        if (event.detail.changeTurn) {
            // Change the player turn
            changeTurn();
        }
    }
    
    // When the move is an attack dispatch a attack event and check if can still
    // attacking with the same piece, if so, then avoid changeTurn
    board.addEventListener('piecemove', function (event) {
        var piece = event.detail.piece;
        var field = event.detail.to;
        
        // piece has opponent details?
        if (!piece.detail) {
            return;
        }
        
        var query = queryField(field.detail.line, field.detail.column);
        var opponent = piece.detail[query];
        
        // No opponents attacked?
        if (!opponent) {
            return;
        }
        
        // Create a attack event
        var attackEvent = new CustomEvent('pieceattack', { 'detail': {
            piece: piece,
            opponent: opponent,
            field: opponent.parentElement,
            from: event.detail.from,
            to: field,
            turn: event.detail.turn,
            changeTurn: event.detail.changeTurn
        }});
        
        // trigger board
        board.dispatchEvent(attackEvent);
        
        
        // Player can keep playing there is more pieces to be attacked
        if (piecePossibleAttackMovies(piece).length > 0) {
            event.detail.changeTurn = false;
            
            // You moved the piece, but you will need to move it again ;)
            // Oh IE8, where is your :not pseudo selector?!?
            var els = board.querySelectorAll('a.player' + piecePlayerId(piece));
            for (var i = 0; i < els.length; i++) {
                if (els[i] !== piece) {
                    els[i].removeAttribute('href');
                }
            }
            
            // This will help to show what is your new allowed moves
            var clickEvent = new MouseEvent('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true,
                'target': piece
            });
            
            piece.dispatchEvent(clickEvent);
                
        }
    });
    
    // Transform the piece in a queen when touch oposite border
    board.addEventListener('piecemove', function (event) {
        var piece = event.detail.piece;
        var destine = event.detail.to;
        
        // Already a queen
        if (piece.className.indexOf('queen') >= 0) {
            return;
        }
        
        var id = piecePlayerId(piece);
        
        if ((id === 0 && destine.detail.line === BOARD_SIZE - 1)
            || (id === 1 && destine.detail.line === 0)) {
                
            var img = document.createElement('img');
            img.src = 'Trollface.png';

            piece.className += ' queen';
            piece.appendChild(img);
        }
    });
    
    // When attack is triggered will remove the opponent piece
    board.addEventListener('pieceattack', function (event) {
        var opponent = event.detail.opponent;
        
        // Move the piece to respective dash
        pieceToDash(opponent);
        
        var pieceRemoveEvent = new CustomEvent('pieceremove', { 'detail': {
            piece: opponent,
            attacker: piece,
            field: field,
            turn: event.detail.turn,
            changeTurn: event.detail.changeTurn
        }});
        
        // trigger board
        board.dispatchEvent(pieceRemoveEvent);
    });
    
    // When piece is removed check if still pieces in the board to end the game
    board.addEventListener('pieceremove', function (event) {
        var piece = event.detail.piece;
        
        var id = piecePlayerId(piece);
        
        if (board.querySelectorAll('a.player' + id).length > 0) {
            return;
        }

        var gameoverEvent = new CustomEvent('gameover', { 'detail': {
            winner: event.detail.attacker,
            losser: piece,
            motive: 'no_pieces_left',
            turn: event.detail.turn
        }});
        
        // trigger draughts
        draughts.dispatchEvent(gameoverEvent);
    });
    
    // When gameover display the banner-msg
    draughts.addEventListener('gameover', function (event) {
        var banner = draughts.querySelector('#banner-msg');
        
        var player = banner.querySelector('h2');
        // Using innerHTML because IE8 doesn't have textContent
        player.innerHTML = 'Player' + (piecePlayerId(event.detail.winner) + 1);
        
        banner.style.display = 'block';
    });
    
    board.addEventListener('click', function (event) {
        event.target = event.target || event.srcElement;
        var mask = closestClassMatchElement(event.target, /move/i);
        if (!mask || !mask.parentElement) {
            return;
        }
        
        piece = board.querySelector('a.focus');
        var field = mask.parentElement;
        
        // Move the piece in the board
        movePiece(piece, field);
    });
    
    
    // Disable drag events on the body
    document.body.addEventListener('dragstart', function (event) {
        // IE8 doesn't have preventDefault, need to return null
        event.preventDefault && event.preventDefault();
        return;
    });
});