"use strict";

;(function() {

	var root = this;
	var previous_emoji = root.EmojiConvertor;


	/**
	 * @global
	 * @namespace
	 */

	var emoji = function(){

		var self = this;

		/**
		 * The set of images to use for graphical emoji.
		 *
		 * @memberof emoji
		 * @type {string}
		 */
		self.img_set = 'apple';

		/**
		 * Configuration details for different image sets. This includes a path to a directory containing the
		 * individual images (`path`) and a URL to sprite sheets (`sheet`). All of these images can be found
		 * in the [emoji-data repository]{@link https://github.com/iamcal/emoji-data}. Using a CDN for these
		 * is not a bad idea.
		 *
		 * @memberof emoji
		 * @type {object}
		 */
		self.img_sets = {
			'apple' : {'path' : '/emoji-data/img-apple-64/', 'sheet' : '/emoji-data/sheet_apple_64.png', 'sheet_size' : 64, 'mask' : 1},
			'google' : {'path' : '/emoji-data/img-google-64/', 'sheet' : '/emoji-data/sheet_google_64.png', 'sheet_size' : 64, 'mask' : 2},
			'twitter' : {'path' : '/emoji-data/img-twitter-64/', 'sheet' : '/emoji-data/sheet_twitter_64.png', 'sheet_size' : 64, 'mask' : 4},
			'facebook' : {'path' : '/emoji-data/img-facebook-64/', 'sheet' : '/emoji-data/sheet_facebook_64.png', 'sheet_size' : 64, 'mask' : 8},
			'messenger' : {'path' : '/emoji-data/img-messenger-64/', 'sheet' : '/emoji-data/sheet_messenger_64.png', 'sheet_size' : 64, 'mask' : 16},
		};

		/**
		 * Use a CSS class instead of specifying a sprite or background image for
		 * the span representing the emoticon. This requires a CSS sheet with
		 * emoticon data-uris.
		 *
		 * @memberof emoji
		 * @type bool
		 * @todo document how to build the CSS stylesheet self requires.
		 */
		self.use_css_imgs = false;

		/**
		 * Instead of replacing emoticons with the appropriate representations,
		 * replace them with their colon string representation.
		 * @memberof emoji
		 * @type bool
		 */
		self.colons_mode = false;
		self.text_mode = false;

		/**
		 * If true, sets the "title" property on the span or image that gets
		 * inserted for the emoticon.
		 * @memberof emoji
		 * @type bool
		 */
		self.include_title = false;

		/**
		 * If true, sets the text of the span or image that gets inserted for the
		 * emoticon.
		 * @memberof emoji
		 * @type bool
		 */
		self.include_text = false;

		/**
		 * If the platform supports native emoticons, use those instead
		 * of the fallbacks.
		 * @memberof emoji
		 * @type bool
		 */
		self.allow_native = true;

		/**
		 * Wrap native with a <span class="emoji-native"></span> to allow styling
		 * @memberof emoji
		 * @type bool
		 */
		self.wrap_native = false;

		/**
		 * Set to true to use CSS sprites instead of individual images on
		 * platforms that support it.
		 *
		 * @memberof emoji
		 * @type bool
		 */
		self.use_sheet = false;

		/**
		 *
		 * Set to true to avoid black & white native Windows emoji being used.
		 *
		 * @memberof emoji
		 * @type bool
		 */
		self.avoid_ms_emoji = true;

		/**
		 *
		 * Set to true to allow :CAPITALIZATION:
		 *
		 * @memberof emoji
		 * @type bool
		 */
		self.allow_caps = false;


		/**
		 *
		 * Suffix to allow for individual image cache busting
		 *
		 * @memberof emoji
		 * @type string
		 */
		self.img_suffix = '';


		// Keeps track of what has been initialized.
		/** @private */
		self.inits = {};
		self.map = {};

		// discover the environment settings
		self.init_env();

		return self;
	}

	emoji.prototype.noConflict = function(){
		root.EmojiConvertor = previous_emoji;
		return emoji;
	}


	/**
	 * @memberof emoji
	 * @param {string} str A string potentially containing ascii emoticons
	 * (ie. `:)`)
	 *
	 * @returns {string} A new string with all emoticons in `str`
	 * replaced by a representatation that's supported by the current
	 * environtment.
	 */
	emoji.prototype.replace_emoticons = function(str){
		var self = this;
		var colonized = self.replace_emoticons_with_colons(str);
		return self.replace_colons(colonized);
	};

	/**
	 * @memberof emoji
	 * @param {string} str A string potentially containing ascii emoticons
	 * (ie. `:)`)
	 *
	 * @returns {string} A new string with all emoticons in `str`
	 * replaced by their colon string representations (ie. `:smile:`)
	 */
	emoji.prototype.replace_emoticons_with_colons = function(str){
		var self = this;
		self.init_emoticons();
		var _prev_offset = 0;
		var emoticons_with_parens = [];
		var str_replaced = str.replace(self.rx_emoticons, function(m, $1, emoticon, offset){
			var prev_offset = _prev_offset;
			_prev_offset = offset + m.length;

			var has_open_paren = emoticon.indexOf('(') !== -1;
			var has_close_paren = emoticon.indexOf(')') !== -1;

			/*
			 * Track paren-having emoticons for fixing later
			 */
			if ((has_open_paren || has_close_paren) && emoticons_with_parens.indexOf(emoticon) == -1) {
				emoticons_with_parens.push(emoticon);
			}

			/*
			 * Look for preceding open paren for emoticons that contain a close paren
			 * This prevents matching "8)" inside "(around 7 - 8)"
			 */
			if (has_close_paren && !has_open_paren) {
				var piece = str.substring(prev_offset, offset);
				if (piece.indexOf('(') !== -1 && piece.indexOf(')') === -1) return m;
			}

			/*
			 * See if we're in a numbered list
			 * This prevents matching "8)" inside "7) foo\n8) bar"
			 */
			if (m === '\n8)') {
				var before_match = str.substring(0, offset);
				if (/\n?(6\)|7\))/.test(before_match)) return m;
			}

			var val = self.data[self.map.emoticons[emoticon]][3][0];
			return val ? $1+':'+val+':' : m;
		});

		/*
		 * Come back and fix emoticons we ignored because they were inside parens.
		 * It's useful to do self at the end so we don't get tripped up by other,
		 * normal emoticons
		 */
		if (emoticons_with_parens.length) {
			var escaped_emoticons = emoticons_with_parens.map(self.escape_rx);
			var parenthetical_rx = new RegExp('(\\(.+)('+escaped_emoticons.join('|')+')(.+\\))', 'g');

			str_replaced = str_replaced.replace(parenthetical_rx, function(m, $1, emoticon, $2) {
				var val = self.data[self.map.emoticons[emoticon]][3][0];
				return val ? $1+':'+val+':'+$2 : m;
			});
		}

		return str_replaced;
	};

	/**
	 * @memberof emoji
	 * @param {string} str A string potentially containing colon string
	 * representations of emoticons (ie. `:smile:`)
	 *
	 * @returns {string} A new string with all colon string emoticons replaced
	 * with the appropriate representation.
	 */
	emoji.prototype.replace_colons = function(str){
		var self = this;
		self.init_colons();

		return str.replace(self.rx_colons, function(m){
			var idx = m.substr(1, m.length-2);
			if (self.allow_caps) idx = idx.toLowerCase();

			// special case - an emoji with a skintone modified
			if (idx.indexOf('::skin-tone-') > -1){

				var skin_tone = idx.substr(-1, 1);
				var skin_idx = 'skin-tone-'+skin_tone;
				var skin_val = self.map.colons[skin_idx];

				idx = idx.substr(0, idx.length - 13);

				var val = self.map.colons[idx];
				if (val){
					return self.replacement(val, idx, ':', {
						'idx'		: skin_val,
						'actual'	: skin_idx,
						'wrapper'	: ':'
					});
				}else{
					return ':' + idx + ':' + self.replacement(skin_val, skin_idx, ':');
				}
			}else{
				var val = self.map.colons[idx];
				return val ? self.replacement(val, idx, ':') : m;
			}
		});
	};

	/**
	 * @memberof emoji
	 * @param {string} str A string potentially containing unified unicode
	 * emoticons. (ie. 😄)
	 *
	 * @returns {string} A new string with all unicode emoticons replaced with
	 * the appropriate representation for the current environment.
	 */
	emoji.prototype.replace_unified = function(str){
		var self = this;
		self.init_unified();
		return str.replace(self.rx_unified, function(m, p1, p2){

			var val = self.map.unified[p1];
			if (val){
				var idx = null;
				if (p2 == '\uD83C\uDFFB') idx = '1f3fb';
				if (p2 == '\uD83C\uDFFC') idx = '1f3fc';
				if (p2 == '\uD83C\uDFFD') idx = '1f3fd';
				if (p2 == '\uD83C\uDFFE') idx = '1f3fe';
				if (p2 == '\uD83C\uDFFF') idx = '1f3ff';
				if (idx){
					return self.replacement(val, null, null, {
						idx	: idx,
						actual	: p2,
						wrapper	: ''
					});
					}
				return self.replacement(val);
			}

			val = self.map.unified_vars[p1];
			if (val){
				return self.replacement(val[0], null, null, {
					'idx'		: val[1],
					'actual'	: '',
					'wrapper'	: '',
				});
			}

			return m;
		});
	};

	emoji.prototype.addAliases = function(map){
		var self = this;

		self.init_colons();
		for (var i in map){
			self.map.colons[i] = map[i];
		}
	};

	emoji.prototype.removeAliases = function(list){
		var self = this;

		for (var i=0; i<list.length; i++){
			var alias = list[i];

			// first, delete the alias mapping
			delete self.map.colons[alias];

			// now reset it to the default, if one exists
			finder_block: {
				for (var j in self.data){
					for (var k=0; k<self.data[j][3].length; k++){
						if (alias == self.data[j][3][k]){
							self.map.colons[alias] = j;
							break finder_block;
						}
					}
				}
			}
		}
	};


	// Does the actual replacement of a character with the appropriate
	/** @private */
	emoji.prototype.replacement = function(idx, actual, wrapper, variation, is_extra){
		var self = this;

		var full_idx = idx;

		// for emoji with variation modifiers, set `extra` to the standalone output for the
		// modifier (used if we can't combine the glyph) and set variation_idx to key of the
		// variation modifier (used below)
		var extra = '';
		var var_idx = null;
		if (typeof variation === 'object'){
			extra = self.replacement(variation.idx, variation.actual, variation.wrapper, undefined, true);
			var_idx = variation.idx;
		}

		// deal with simple modes (colons and text) first
		wrapper = wrapper || '';
		if (self.colons_mode) return ':'+self.data[idx][3][0]+':'+extra;
		var text_name = (actual) ? wrapper+actual+wrapper : self.data[idx][8] || wrapper+self.data[idx][3][0]+wrapper;
		if (self.text_mode) return text_name + extra;

		// figure out which images and code points to use, based on the skin variations. this information is also used for
		// unified native output mode
		var img = self.find_image(idx, var_idx);

		// native modes next.
		// for variations selectors, we just need to output them raw, which `extra` will contain. since softbank and google don't
		// support skin variations, we'll keep `extra` around, every if we have a valid variation selector
		self.init_env();
		if (self.replace_mode == 'softbank' && self.allow_native && self.data[idx][1]) return self.format_native(self.data[idx][1] + extra, !is_extra);
		if (self.replace_mode == 'google'   && self.allow_native && self.data[idx][2]) return self.format_native(self.data[idx][2] + extra, !is_extra);

		// for unified (and images, below), we can use the variation info and throw away the `extra` contents
		if (img.is_var){
			extra = '';
		}
		if (self.replace_mode == 'unified' && self.allow_native) return self.format_native(img.unified + extra, !is_extra);


		// finally deal with image modes.
		// the call to .find_image() earlier checked if the image set and particular emoji supports variations,
		// otherwise we can return it as a separate image (already calculated in `extra`).
		// first we set up the params we'll use if we can't use a variation.
		var title = self.include_title ? ' title="'+(actual || self.data[idx][3][0])+'"' : '';
		var text  = self.include_text  ? wrapper+(actual || self.data[idx][3][0])+wrapper : '';

		// custom image for this glyph?
		if (self.data[idx][7]){
			img.path = self.data[idx][7];
			img.px = null;
			img.py = null;
			img.is_var = false;
		}

		// if we're displaying a variation, include it in the text
		if (img.is_var && self.include_text && variation && variation.actual && variation.wrapper) {
			text += variation.wrapper+variation.actual+variation.wrapper;
		}

		// output
		if (self.replace_mode == 'css') {
			if (self.use_sheet && img.px != null && img.py != null){
				// simplified calculation of `100 * (position * sprite_size) / ( (sheet_size * sprite_size) - sprite_size )`
				var sheet_x = 100 * img.px / (self.sheet_size - 1);
				var sheet_y = 100 * img.py / (self.sheet_size - 1);
				var sheet_sz = 100 * self.sheet_size;

				var style = 'background: url('+img.sheet+');background-position:'+(sheet_x)+'% '+(sheet_y)+'%;background-size:'+sheet_sz+'% '+sheet_sz+'%';
				return '<span class="emoji-outer emoji-sizer"><span class="emoji-inner" style="'+style+'"'+title+' data-codepoints="'+img.full_idx+'">'+text+'</span></span>'+extra;
			}else if (self.use_css_imgs){
				return '<span class="emoji emoji-'+idx+'"'+title+' data-codepoints="'+img.full_idx+'">'+text+'</span>'+extra;
			}else{
				return '<span class="emoji emoji-sizer" style="background-image:url('+img.path+')"'+title+' data-codepoints="'+img.full_idx+'">'+text+'</span>'+extra;
			}
		}
		return '<img src="'+img.path+'" class="emoji" data-codepoints="'+img.full_idx+'" '+title+'/>'+extra;
	};

	// Wraps the output of a native endpoint, if configured
	/** @private */
	emoji.prototype.format_native = function(native, allow_wrap){
		var self = this;

		if (self.wrap_native && allow_wrap){
			return '<span class="emoji-native">'+ native + '</span>';
		}
		return native;
	};

	// Finds the best image to display, taking into account image set precedence and obsoletes
	/** @private */
	emoji.prototype.find_image = function(idx, var_idx){
		var self = this;

		// set up some initial state
		var out = {
			'path'		: '',
			'sheet'		: '',
			'sheet_size'	: 0,
			'px'		: self.data[idx][4],
			'py'		: self.data[idx][5],
			'full_idx'	: idx,
			'is_var'	: false,
			'unified'	: self.data[idx][0][0]
		};
		var use_mask = self.data[idx][6];

		// can we use a variation?
		if (var_idx && self.variations_data[idx] && self.variations_data[idx][var_idx]){
			var var_data = self.variations_data[idx][var_idx];

			out.px = var_data[1];
			out.py = var_data[2];
			out.full_idx = var_data[0];
			out.is_var = true;
			out.unified = var_data[4][0];
			use_mask = var_data[3];
		}

		// this matches `build/build_image.php` `in emoji-data`, so that sheet and images modes always
		// agree about the image to use.
		var try_order = [self.img_set, 'apple', 'google', 'twitter', 'facebook', 'messenger'];

		// for each image set, see if we have the image we need. otherwise check for an obsolete in
		// that image set
		for (var j=0; j<try_order.length; j++){

			// check we haven't passed in a bad value for img_set, or messed up the img_sets hash
			if (!self.img_sets[try_order[j]]){
				throw Error("Invalid value for img_set");
			}

			if (use_mask & self.img_sets[try_order[j]].mask){
				out.path = self.img_sets[try_order[j]].path+out.full_idx+'.png' + self.img_suffix;
				// if we're not changing glyph, use our base set for sheets - it has every glyph
				out.sheet = self.img_sets[self.img_set].sheet;
				out.sheet_size = self.img_sets[self.img_set].sheet_size;
				return out;
			}
			if (self.obsoletes_data[out.full_idx]){
				var ob_data = self.obsoletes_data[out.full_idx];

				if (ob_data[3] & self.img_sets[try_order[j]].mask){
					out.path = self.img_sets[try_order[j]].path+ob_data[0]+'.png' + self.img_suffix;
					out.sheet = self.img_sets[try_order[j]].sheet;
					out.sheet_size = self.img_sets[try_order[j]].sheet_size;
					out.px = ob_data[1];
					out.py = ob_data[2];
					return out;
				}
			}
		}

		return out;
	};

	// Initializes the text emoticon data
	/** @private */
	emoji.prototype.init_emoticons = function(){
		var self = this;
		if (self.inits.emoticons) return;
		self.init_colons(); // we require this for the emoticons map
		self.inits.emoticons = 1;

		var a = [];
		self.map.emoticons = {};
		for (var i in self.emoticons_data){
			// because we never see some characters in our text except as entities, we must do some replacing
			var emoticon = i.replace(/\&/g, '&amp;').replace(/\</g, '&lt;').replace(/\>/g, '&gt;');

			if (!self.map.colons[self.emoticons_data[i]]) continue;

			self.map.emoticons[emoticon] = self.map.colons[self.emoticons_data[i]];
			a.push(self.escape_rx(emoticon));
		}
		self.rx_emoticons = new RegExp(('(^|\\s)('+a.join('|')+')(?=$|[\\s|\\?\\.,!])'), 'g');
	};

	// Initializes the colon string data
	/** @private */
	emoji.prototype.init_colons = function(){
		var self = this;
		if (self.inits.colons) return;
		self.inits.colons = 1;
		self.rx_colons = new RegExp('\:[a-zA-Z0-9-_+]+\:(\:skin-tone-[2-6]\:)?', 'g');
		self.map.colons = {};
		for (var i in self.data){
			for (var j=0; j<self.data[i][3].length; j++){
				self.map.colons[self.data[i][3][j]] = i;
			}
		}
	};

	// initializes the unified unicode emoticon data
	/** @private */
	emoji.prototype.init_unified = function(){
		var self = this;
		if (self.inits.unified) return;
		self.inits.unified = 1;

		var a = [];
		self.map.unified = {};
		self.map.unified_vars = {};

		for (var i in self.data){
			for (var j=0; j<self.data[i][0].length; j++){
				a.push(self.data[i][0][j].replace('*', '\\*'));
				self.map.unified[self.data[i][0][j]] = i;
			}
		}
		for (var i in self.variations_data){
			// skip simple append-style skin tones
			if (self.variations_data[i]['1f3fb']){
				if (self.variations_data[i]['1f3fb'][0] == i+'-1f3fb') continue;
			}

			for (var k in self.variations_data[i]){
				for (var j=0; j<self.variations_data[i][k][4].length; j++){
					a.push(self.variations_data[i][k][4][j].replace('*', '\\*'));
					self.map.unified_vars[self.variations_data[i][k][4][j]] = [i, k];
				}
			}
		}

		a = a.sort(function(a,b){
			 return b.length - a.length;
		});

		self.rx_unified = new RegExp('('+a.join('|')+')(\uD83C[\uDFFB-\uDFFF])?', "g");
	};

	// initializes the environment, figuring out what representation
	// of emoticons is best.
	/** @private */
	emoji.prototype.init_env = function(){
		var self = this;
		if (self.inits.env) return;
		self.inits.env = 1;
		self.replace_mode = 'img';
		var supports_css = false;
		if (typeof(navigator) !== 'undefined') {
			var ua = navigator.userAgent;
			if (typeof window !== 'undefined' && window.getComputedStyle){
				try {
					var st = window.getComputedStyle(document.body);
					if (st['background-size'] || st['backgroundSize']){
						supports_css = true;
					}
				} catch(e){
					// Swallow an exception caused by hidden iFrames on Firefox
					// https://github.com/iamcal/js-emoji/issues/73
					if (ua.match(/Firefox/i)){
						supports_css = true;
					}
				}
			}
			if (navigator.product.match(/ReactNative/i)){
				self.replace_mode = 'unified';
				return;
			}
			if (ua.match(/(iPhone|iPod|iPad|iPhone\s+Simulator)/i)){
				if (ua.match(/OS\s+[12345]/i)){
					self.replace_mode = 'softbank';
					return;
				}
				if (ua.match(/OS\s+[6789]/i)){
					self.replace_mode = 'unified';
					return;
				}
			}
			if (ua.match(/Mac OS X (10[._ ](?:[789]|1)|11[._ ]\d)/i)){
				self.replace_mode = 'unified';
				return;
			}
			if (!self.avoid_ms_emoji){
				if (ua.match(/Windows NT 6.[1-9]/i) || ua.match(/Windows NT 10.[0-9]/i)){
					if (!ua.match(/Chrome/i) && !ua.match(/MSIE 8/i)){
						self.replace_mode = 'unified';
						return;
					}
				}
			}
		}

		// Need a better way to detect android devices that actually
		// support emoji.
		if (false && ua.match(/Android/i)){
			self.replace_mode = 'google';
			return;
		}
		if (supports_css){
			self.replace_mode = 'css';
			return;
		}
		// nothing fancy detected - use images
	};
	/** @private */
	emoji.prototype.escape_rx = function(text){
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
	};
	emoji.prototype.sheet_size = 60;
	/** @private */
	emoji.prototype.data = {
		"0023-fe0f-20e3":[["\u0023\uFE0F\u20E3","\u0023\u20E3"],"\uE210","\uDBBA\uDC2C",["hash"],0,0,7,0],
		"002a-fe0f-20e3":[["\u002A\uFE0F\u20E3","\u002A\u20E3"],"","",["keycap_star"],0,1,7,0],
		"0030-fe0f-20e3":[["\u0030\uFE0F\u20E3","\u0030\u20E3"],"\uE225","\uDBBA\uDC37",["zero"],0,2,7,0],
		"0031-fe0f-20e3":[["\u0031\uFE0F\u20E3","\u0031\u20E3"],"\uE21C","\uDBBA\uDC2E",["one"],0,3,7,0],
		"0032-fe0f-20e3":[["\u0032\uFE0F\u20E3","\u0032\u20E3"],"\uE21D","\uDBBA\uDC2F",["two"],0,4,7,0],
		"0033-fe0f-20e3":[["\u0033\uFE0F\u20E3","\u0033\u20E3"],"\uE21E","\uDBBA\uDC30",["three"],0,5,7,0],
		"0034-fe0f-20e3":[["\u0034\uFE0F\u20E3","\u0034\u20E3"],"\uE21F","\uDBBA\uDC31",["four"],0,6,7,0],
		"0035-fe0f-20e3":[["\u0035\uFE0F\u20E3","\u0035\u20E3"],"\uE220","\uDBBA\uDC32",["five"],0,7,7,0],
		"0036-fe0f-20e3":[["\u0036\uFE0F\u20E3","\u0036\u20E3"],"\uE221","\uDBBA\uDC33",["six"],0,8,7,0],
		"0037-fe0f-20e3":[["\u0037\uFE0F\u20E3","\u0037\u20E3"],"\uE222","\uDBBA\uDC34",["seven"],0,9,7,0],
		"0038-fe0f-20e3":[["\u0038\uFE0F\u20E3","\u0038\u20E3"],"\uE223","\uDBBA\uDC35",["eight"],0,10,7,0],
		"0039-fe0f-20e3":[["\u0039\uFE0F\u20E3","\u0039\u20E3"],"\uE224","\uDBBA\uDC36",["nine"],0,11,7,0],
		"00a9-fe0f":[["\u00A9\uFE0F","\u00A9"],"\uE24E","\uDBBA\uDF29",["copyright"],0,12,7,0],
		"00ae-fe0f":[["\u00AE\uFE0F","\u00AE"],"\uE24F","\uDBBA\uDF2D",["registered"],0,13,7,0],
		"1f004":[["\uD83C\uDC04"],"\uE12D","\uDBBA\uDC0B",["mahjong"],0,14,15,0],
		"1f0cf":[["\uD83C\uDCCF"],"","\uDBBA\uDC12",["black_joker"],0,15,15,0],
		"1f170-fe0f":[["\uD83C\uDD70\uFE0F","\uD83C\uDD70"],"\uE532","\uDBB9\uDD0B",["a"],0,16,15,0],
		"1f171-fe0f":[["\uD83C\uDD71\uFE0F","\uD83C\uDD71"],"\uE533","\uDBB9\uDD0C",["b"],0,17,15,0],
		"1f17e-fe0f":[["\uD83C\uDD7E\uFE0F","\uD83C\uDD7E"],"\uE535","\uDBB9\uDD0E",["o2"],0,18,15,0],
		"1f17f-fe0f":[["\uD83C\uDD7F\uFE0F","\uD83C\uDD7F"],"\uE14F","\uDBB9\uDFF6",["parking"],0,19,15,0],
		"1f18e":[["\uD83C\uDD8E"],"\uE534","\uDBB9\uDD0D",["ab"],0,20,15,0],
		"1f191":[["\uD83C\uDD91"],"","\uDBBA\uDF84",["cl"],0,21,15,0],
		"1f192":[["\uD83C\uDD92"],"\uE214","\uDBBA\uDF38",["cool"],0,22,15,0],
		"1f193":[["\uD83C\uDD93"],"","\uDBBA\uDF21",["free"],0,23,15,0],
		"1f194":[["\uD83C\uDD94"],"\uE229","\uDBBA\uDF81",["id"],0,24,15,0],
		"1f195":[["\uD83C\uDD95"],"\uE212","\uDBBA\uDF36",["new"],0,25,15,0],
		"1f196":[["\uD83C\uDD96"],"","\uDBBA\uDF28",["ng"],0,26,15,0],
		"1f197":[["\uD83C\uDD97"],"\uE24D","\uDBBA\uDF27",["ok"],0,27,15,0],
		"1f198":[["\uD83C\uDD98"],"","\uDBBA\uDF4F",["sos"],0,28,15,0],
		"1f199":[["\uD83C\uDD99"],"\uE213","\uDBBA\uDF37",["up"],0,29,15,0],
		"1f19a":[["\uD83C\uDD9A"],"\uE12E","\uDBBA\uDF32",["vs"],0,30,15,0],
		"1f1e6-1f1e8":[["\uD83C\uDDE6\uD83C\uDDE8"],"","",["flag-ac"],0,31,15,0],
		"1f1e6-1f1e9":[["\uD83C\uDDE6\uD83C\uDDE9"],"","",["flag-ad"],0,32,15,0],
		"1f1e6-1f1ea":[["\uD83C\uDDE6\uD83C\uDDEA"],"","",["flag-ae"],0,33,15,0],
		"1f1e6-1f1eb":[["\uD83C\uDDE6\uD83C\uDDEB"],"","",["flag-af"],0,34,15,0],
		"1f1e6-1f1ec":[["\uD83C\uDDE6\uD83C\uDDEC"],"","",["flag-ag"],0,35,15,0],
		"1f1e6-1f1ee":[["\uD83C\uDDE6\uD83C\uDDEE"],"","",["flag-ai"],0,36,15,0],
		"1f1e6-1f1f1":[["\uD83C\uDDE6\uD83C\uDDF1"],"","",["flag-al"],0,37,15,0],
		"1f1e6-1f1f2":[["\uD83C\uDDE6\uD83C\uDDF2"],"","",["flag-am"],0,38,15,0],
		"1f1e6-1f1f4":[["\uD83C\uDDE6\uD83C\uDDF4"],"","",["flag-ao"],0,39,15,0],
		"1f1e6-1f1f6":[["\uD83C\uDDE6\uD83C\uDDF6"],"","",["flag-aq"],0,40,15,0],
		"1f1e6-1f1f7":[["\uD83C\uDDE6\uD83C\uDDF7"],"","",["flag-ar"],0,41,15,0],
		"1f1e6-1f1f8":[["\uD83C\uDDE6\uD83C\uDDF8"],"","",["flag-as"],0,42,15,0],
		"1f1e6-1f1f9":[["\uD83C\uDDE6\uD83C\uDDF9"],"","",["flag-at"],0,43,15,0],
		"1f1e6-1f1fa":[["\uD83C\uDDE6\uD83C\uDDFA"],"","",["flag-au"],0,44,15,0],
		"1f1e6-1f1fc":[["\uD83C\uDDE6\uD83C\uDDFC"],"","",["flag-aw"],0,45,15,0],
		"1f1e6-1f1fd":[["\uD83C\uDDE6\uD83C\uDDFD"],"","",["flag-ax"],0,46,15,0],
		"1f1e6-1f1ff":[["\uD83C\uDDE6\uD83C\uDDFF"],"","",["flag-az"],0,47,15,0],
		"1f1e7-1f1e6":[["\uD83C\uDDE7\uD83C\uDDE6"],"","",["flag-ba"],0,48,15,0],
		"1f1e7-1f1e7":[["\uD83C\uDDE7\uD83C\uDDE7"],"","",["flag-bb"],0,49,15,0],
		"1f1e7-1f1e9":[["\uD83C\uDDE7\uD83C\uDDE9"],"","",["flag-bd"],0,50,15,0],
		"1f1e7-1f1ea":[["\uD83C\uDDE7\uD83C\uDDEA"],"","",["flag-be"],0,51,15,0],
		"1f1e7-1f1eb":[["\uD83C\uDDE7\uD83C\uDDEB"],"","",["flag-bf"],0,52,15,0],
		"1f1e7-1f1ec":[["\uD83C\uDDE7\uD83C\uDDEC"],"","",["flag-bg"],0,53,15,0],
		"1f1e7-1f1ed":[["\uD83C\uDDE7\uD83C\uDDED"],"","",["flag-bh"],0,54,15,0],
		"1f1e7-1f1ee":[["\uD83C\uDDE7\uD83C\uDDEE"],"","",["flag-bi"],0,55,15,0],
		"1f1e7-1f1ef":[["\uD83C\uDDE7\uD83C\uDDEF"],"","",["flag-bj"],0,56,15,0],
		"1f1e7-1f1f1":[["\uD83C\uDDE7\uD83C\uDDF1"],"","",["flag-bl"],0,57,15,0],
		"1f1e7-1f1f2":[["\uD83C\uDDE7\uD83C\uDDF2"],"","",["flag-bm"],0,58,15,0],
		"1f1e7-1f1f3":[["\uD83C\uDDE7\uD83C\uDDF3"],"","",["flag-bn"],0,59,15,0],
		"1f1e7-1f1f4":[["\uD83C\uDDE7\uD83C\uDDF4"],"","",["flag-bo"],1,0,15,0],
		"1f1e7-1f1f6":[["\uD83C\uDDE7\uD83C\uDDF6"],"","",["flag-bq"],1,1,15,0],
		"1f1e7-1f1f7":[["\uD83C\uDDE7\uD83C\uDDF7"],"","",["flag-br"],1,2,15,0],
		"1f1e7-1f1f8":[["\uD83C\uDDE7\uD83C\uDDF8"],"","",["flag-bs"],1,3,15,0],
		"1f1e7-1f1f9":[["\uD83C\uDDE7\uD83C\uDDF9"],"","",["flag-bt"],1,4,15,0],
		"1f1e7-1f1fb":[["\uD83C\uDDE7\uD83C\uDDFB"],"","",["flag-bv"],1,5,15,0],
		"1f1e7-1f1fc":[["\uD83C\uDDE7\uD83C\uDDFC"],"","",["flag-bw"],1,6,15,0],
		"1f1e7-1f1fe":[["\uD83C\uDDE7\uD83C\uDDFE"],"","",["flag-by"],1,7,15,0],
		"1f1e7-1f1ff":[["\uD83C\uDDE7\uD83C\uDDFF"],"","",["flag-bz"],1,8,15,0],
		"1f1e8-1f1e6":[["\uD83C\uDDE8\uD83C\uDDE6"],"","",["flag-ca"],1,9,15,0],
		"1f1e8-1f1e8":[["\uD83C\uDDE8\uD83C\uDDE8"],"","",["flag-cc"],1,10,15,0],
		"1f1e8-1f1e9":[["\uD83C\uDDE8\uD83C\uDDE9"],"","",["flag-cd"],1,11,15,0],
		"1f1e8-1f1eb":[["\uD83C\uDDE8\uD83C\uDDEB"],"","",["flag-cf"],1,12,15,0],
		"1f1e8-1f1ec":[["\uD83C\uDDE8\uD83C\uDDEC"],"","",["flag-cg"],1,13,15,0],
		"1f1e8-1f1ed":[["\uD83C\uDDE8\uD83C\uDDED"],"","",["flag-ch"],1,14,15,0],
		"1f1e8-1f1ee":[["\uD83C\uDDE8\uD83C\uDDEE"],"","",["flag-ci"],1,15,15,0],
		"1f1e8-1f1f0":[["\uD83C\uDDE8\uD83C\uDDF0"],"","",["flag-ck"],1,16,15,0],
		"1f1e8-1f1f1":[["\uD83C\uDDE8\uD83C\uDDF1"],"","",["flag-cl"],1,17,15,0],
		"1f1e8-1f1f2":[["\uD83C\uDDE8\uD83C\uDDF2"],"","",["flag-cm"],1,18,15,0],
		"1f1e8-1f1f3":[["\uD83C\uDDE8\uD83C\uDDF3"],"\uE513","\uDBB9\uDCED",["cn","flag-cn"],1,19,15,0],
		"1f1e8-1f1f4":[["\uD83C\uDDE8\uD83C\uDDF4"],"","",["flag-co"],1,20,15,0],
		"1f1e8-1f1f5":[["\uD83C\uDDE8\uD83C\uDDF5"],"","",["flag-cp"],1,21,15,0],
		"1f1e8-1f1f7":[["\uD83C\uDDE8\uD83C\uDDF7"],"","",["flag-cr"],1,22,15,0],
		"1f1e8-1f1fa":[["\uD83C\uDDE8\uD83C\uDDFA"],"","",["flag-cu"],1,23,15,0],
		"1f1e8-1f1fb":[["\uD83C\uDDE8\uD83C\uDDFB"],"","",["flag-cv"],1,24,15,0],
		"1f1e8-1f1fc":[["\uD83C\uDDE8\uD83C\uDDFC"],"","",["flag-cw"],1,25,15,0],
		"1f1e8-1f1fd":[["\uD83C\uDDE8\uD83C\uDDFD"],"","",["flag-cx"],1,26,15,0],
		"1f1e8-1f1fe":[["\uD83C\uDDE8\uD83C\uDDFE"],"","",["flag-cy"],1,27,15,0],
		"1f1e8-1f1ff":[["\uD83C\uDDE8\uD83C\uDDFF"],"","",["flag-cz"],1,28,15,0],
		"1f1e9-1f1ea":[["\uD83C\uDDE9\uD83C\uDDEA"],"\uE50E","\uDBB9\uDCE8",["de","flag-de"],1,29,15,0],
		"1f1e9-1f1ec":[["\uD83C\uDDE9\uD83C\uDDEC"],"","",["flag-dg"],1,30,15,0],
		"1f1e9-1f1ef":[["\uD83C\uDDE9\uD83C\uDDEF"],"","",["flag-dj"],1,31,15,0],
		"1f1e9-1f1f0":[["\uD83C\uDDE9\uD83C\uDDF0"],"","",["flag-dk"],1,32,15,0],
		"1f1e9-1f1f2":[["\uD83C\uDDE9\uD83C\uDDF2"],"","",["flag-dm"],1,33,15,0],
		"1f1e9-1f1f4":[["\uD83C\uDDE9\uD83C\uDDF4"],"","",["flag-do"],1,34,15,0],
		"1f1e9-1f1ff":[["\uD83C\uDDE9\uD83C\uDDFF"],"","",["flag-dz"],1,35,15,0],
		"1f1ea-1f1e6":[["\uD83C\uDDEA\uD83C\uDDE6"],"","",["flag-ea"],1,36,15,0],
		"1f1ea-1f1e8":[["\uD83C\uDDEA\uD83C\uDDE8"],"","",["flag-ec"],1,37,15,0],
		"1f1ea-1f1ea":[["\uD83C\uDDEA\uD83C\uDDEA"],"","",["flag-ee"],1,38,15,0],
		"1f1ea-1f1ec":[["\uD83C\uDDEA\uD83C\uDDEC"],"","",["flag-eg"],1,39,15,0],
		"1f1ea-1f1ed":[["\uD83C\uDDEA\uD83C\uDDED"],"","",["flag-eh"],1,40,15,0],
		"1f1ea-1f1f7":[["\uD83C\uDDEA\uD83C\uDDF7"],"","",["flag-er"],1,41,15,0],
		"1f1ea-1f1f8":[["\uD83C\uDDEA\uD83C\uDDF8"],"\uE511","\uDBB9\uDCEB",["es","flag-es"],1,42,15,0],
		"1f1ea-1f1f9":[["\uD83C\uDDEA\uD83C\uDDF9"],"","",["flag-et"],1,43,15,0],
		"1f1ea-1f1fa":[["\uD83C\uDDEA\uD83C\uDDFA"],"","",["flag-eu"],1,44,15,0],
		"1f1eb-1f1ee":[["\uD83C\uDDEB\uD83C\uDDEE"],"","",["flag-fi"],1,45,15,0],
		"1f1eb-1f1ef":[["\uD83C\uDDEB\uD83C\uDDEF"],"","",["flag-fj"],1,46,15,0],
		"1f1eb-1f1f0":[["\uD83C\uDDEB\uD83C\uDDF0"],"","",["flag-fk"],1,47,15,0],
		"1f1eb-1f1f2":[["\uD83C\uDDEB\uD83C\uDDF2"],"","",["flag-fm"],1,48,15,0],
		"1f1eb-1f1f4":[["\uD83C\uDDEB\uD83C\uDDF4"],"","",["flag-fo"],1,49,15,0],
		"1f1eb-1f1f7":[["\uD83C\uDDEB\uD83C\uDDF7"],"\uE50D","\uDBB9\uDCE7",["fr","flag-fr"],1,50,15,0],
		"1f1ec-1f1e6":[["\uD83C\uDDEC\uD83C\uDDE6"],"","",["flag-ga"],1,51,15,0],
		"1f1ec-1f1e7":[["\uD83C\uDDEC\uD83C\uDDE7"],"\uE510","\uDBB9\uDCEA",["gb","uk","flag-gb"],1,52,15,0],
		"1f1ec-1f1e9":[["\uD83C\uDDEC\uD83C\uDDE9"],"","",["flag-gd"],1,53,15,0],
		"1f1ec-1f1ea":[["\uD83C\uDDEC\uD83C\uDDEA"],"","",["flag-ge"],1,54,15,0],
		"1f1ec-1f1eb":[["\uD83C\uDDEC\uD83C\uDDEB"],"","",["flag-gf"],1,55,15,0],
		"1f1ec-1f1ec":[["\uD83C\uDDEC\uD83C\uDDEC"],"","",["flag-gg"],1,56,15,0],
		"1f1ec-1f1ed":[["\uD83C\uDDEC\uD83C\uDDED"],"","",["flag-gh"],1,57,15,0],
		"1f1ec-1f1ee":[["\uD83C\uDDEC\uD83C\uDDEE"],"","",["flag-gi"],1,58,15,0],
		"1f1ec-1f1f1":[["\uD83C\uDDEC\uD83C\uDDF1"],"","",["flag-gl"],1,59,15,0],
		"1f1ec-1f1f2":[["\uD83C\uDDEC\uD83C\uDDF2"],"","",["flag-gm"],2,0,15,0],
		"1f1ec-1f1f3":[["\uD83C\uDDEC\uD83C\uDDF3"],"","",["flag-gn"],2,1,15,0],
		"1f1ec-1f1f5":[["\uD83C\uDDEC\uD83C\uDDF5"],"","",["flag-gp"],2,2,15,0],
		"1f1ec-1f1f6":[["\uD83C\uDDEC\uD83C\uDDF6"],"","",["flag-gq"],2,3,15,0],
		"1f1ec-1f1f7":[["\uD83C\uDDEC\uD83C\uDDF7"],"","",["flag-gr"],2,4,15,0],
		"1f1ec-1f1f8":[["\uD83C\uDDEC\uD83C\uDDF8"],"","",["flag-gs"],2,5,15,0],
		"1f1ec-1f1f9":[["\uD83C\uDDEC\uD83C\uDDF9"],"","",["flag-gt"],2,6,15,0],
		"1f1ec-1f1fa":[["\uD83C\uDDEC\uD83C\uDDFA"],"","",["flag-gu"],2,7,15,0],
		"1f1ec-1f1fc":[["\uD83C\uDDEC\uD83C\uDDFC"],"","",["flag-gw"],2,8,15,0],
		"1f1ec-1f1fe":[["\uD83C\uDDEC\uD83C\uDDFE"],"","",["flag-gy"],2,9,15,0],
		"1f1ed-1f1f0":[["\uD83C\uDDED\uD83C\uDDF0"],"","",["flag-hk"],2,10,15,0],
		"1f1ed-1f1f2":[["\uD83C\uDDED\uD83C\uDDF2"],"","",["flag-hm"],2,11,15,0],
		"1f1ed-1f1f3":[["\uD83C\uDDED\uD83C\uDDF3"],"","",["flag-hn"],2,12,15,0],
		"1f1ed-1f1f7":[["\uD83C\uDDED\uD83C\uDDF7"],"","",["flag-hr"],2,13,15,0],
		"1f1ed-1f1f9":[["\uD83C\uDDED\uD83C\uDDF9"],"","",["flag-ht"],2,14,15,0],
		"1f1ed-1f1fa":[["\uD83C\uDDED\uD83C\uDDFA"],"","",["flag-hu"],2,15,15,0],
		"1f1ee-1f1e8":[["\uD83C\uDDEE\uD83C\uDDE8"],"","",["flag-ic"],2,16,15,0],
		"1f1ee-1f1e9":[["\uD83C\uDDEE\uD83C\uDDE9"],"","",["flag-id"],2,17,15,0],
		"1f1ee-1f1ea":[["\uD83C\uDDEE\uD83C\uDDEA"],"","",["flag-ie"],2,18,15,0],
		"1f1ee-1f1f1":[["\uD83C\uDDEE\uD83C\uDDF1"],"","",["flag-il"],2,19,15,0],
		"1f1ee-1f1f2":[["\uD83C\uDDEE\uD83C\uDDF2"],"","",["flag-im"],2,20,15,0],
		"1f1ee-1f1f3":[["\uD83C\uDDEE\uD83C\uDDF3"],"","",["flag-in"],2,21,15,0],
		"1f1ee-1f1f4":[["\uD83C\uDDEE\uD83C\uDDF4"],"","",["flag-io"],2,22,15,0],
		"1f1ee-1f1f6":[["\uD83C\uDDEE\uD83C\uDDF6"],"","",["flag-iq"],2,23,15,0],
		"1f1ee-1f1f7":[["\uD83C\uDDEE\uD83C\uDDF7"],"","",["flag-ir"],2,24,15,0],
		"1f1ee-1f1f8":[["\uD83C\uDDEE\uD83C\uDDF8"],"","",["flag-is"],2,25,15,0],
		"1f1ee-1f1f9":[["\uD83C\uDDEE\uD83C\uDDF9"],"\uE50F","\uDBB9\uDCE9",["it","flag-it"],2,26,15,0],
		"1f1ef-1f1ea":[["\uD83C\uDDEF\uD83C\uDDEA"],"","",["flag-je"],2,27,15,0],
		"1f1ef-1f1f2":[["\uD83C\uDDEF\uD83C\uDDF2"],"","",["flag-jm"],2,28,15,0],
		"1f1ef-1f1f4":[["\uD83C\uDDEF\uD83C\uDDF4"],"","",["flag-jo"],2,29,15,0],
		"1f1ef-1f1f5":[["\uD83C\uDDEF\uD83C\uDDF5"],"\uE50B","\uDBB9\uDCE5",["jp","flag-jp"],2,30,15,0],
		"1f1f0-1f1ea":[["\uD83C\uDDF0\uD83C\uDDEA"],"","",["flag-ke"],2,31,15,0],
		"1f1f0-1f1ec":[["\uD83C\uDDF0\uD83C\uDDEC"],"","",["flag-kg"],2,32,15,0],
		"1f1f0-1f1ed":[["\uD83C\uDDF0\uD83C\uDDED"],"","",["flag-kh"],2,33,15,0],
		"1f1f0-1f1ee":[["\uD83C\uDDF0\uD83C\uDDEE"],"","",["flag-ki"],2,34,15,0],
		"1f1f0-1f1f2":[["\uD83C\uDDF0\uD83C\uDDF2"],"","",["flag-km"],2,35,15,0],
		"1f1f0-1f1f3":[["\uD83C\uDDF0\uD83C\uDDF3"],"","",["flag-kn"],2,36,15,0],
		"1f1f0-1f1f5":[["\uD83C\uDDF0\uD83C\uDDF5"],"","",["flag-kp"],2,37,15,0],
		"1f1f0-1f1f7":[["\uD83C\uDDF0\uD83C\uDDF7"],"\uE514","\uDBB9\uDCEE",["kr","flag-kr"],2,38,15,0],
		"1f1f0-1f1fc":[["\uD83C\uDDF0\uD83C\uDDFC"],"","",["flag-kw"],2,39,15,0],
		"1f1f0-1f1fe":[["\uD83C\uDDF0\uD83C\uDDFE"],"","",["flag-ky"],2,40,15,0],
		"1f1f0-1f1ff":[["\uD83C\uDDF0\uD83C\uDDFF"],"","",["flag-kz"],2,41,15,0],
		"1f1f1-1f1e6":[["\uD83C\uDDF1\uD83C\uDDE6"],"","",["flag-la"],2,42,15,0],
		"1f1f1-1f1e7":[["\uD83C\uDDF1\uD83C\uDDE7"],"","",["flag-lb"],2,43,15,0],
		"1f1f1-1f1e8":[["\uD83C\uDDF1\uD83C\uDDE8"],"","",["flag-lc"],2,44,15,0],
		"1f1f1-1f1ee":[["\uD83C\uDDF1\uD83C\uDDEE"],"","",["flag-li"],2,45,15,0],
		"1f1f1-1f1f0":[["\uD83C\uDDF1\uD83C\uDDF0"],"","",["flag-lk"],2,46,15,0],
		"1f1f1-1f1f7":[["\uD83C\uDDF1\uD83C\uDDF7"],"","",["flag-lr"],2,47,15,0],
		"1f1f1-1f1f8":[["\uD83C\uDDF1\uD83C\uDDF8"],"","",["flag-ls"],2,48,15,0],
		"1f1f1-1f1f9":[["\uD83C\uDDF1\uD83C\uDDF9"],"","",["flag-lt"],2,49,15,0],
		"1f1f1-1f1fa":[["\uD83C\uDDF1\uD83C\uDDFA"],"","",["flag-lu"],2,50,15,0],
		"1f1f1-1f1fb":[["\uD83C\uDDF1\uD83C\uDDFB"],"","",["flag-lv"],2,51,15,0],
		"1f1f1-1f1fe":[["\uD83C\uDDF1\uD83C\uDDFE"],"","",["flag-ly"],2,52,15,0],
		"1f1f2-1f1e6":[["\uD83C\uDDF2\uD83C\uDDE6"],"","",["flag-ma"],2,53,15,0],
		"1f1f2-1f1e8":[["\uD83C\uDDF2\uD83C\uDDE8"],"","",["flag-mc"],2,54,15,0],
		"1f1f2-1f1e9":[["\uD83C\uDDF2\uD83C\uDDE9"],"","",["flag-md"],2,55,15,0],
		"1f1f2-1f1ea":[["\uD83C\uDDF2\uD83C\uDDEA"],"","",["flag-me"],2,56,15,0],
		"1f1f2-1f1eb":[["\uD83C\uDDF2\uD83C\uDDEB"],"","",["flag-mf"],2,57,15,0],
		"1f1f2-1f1ec":[["\uD83C\uDDF2\uD83C\uDDEC"],"","",["flag-mg"],2,58,15,0],
		"1f1f2-1f1ed":[["\uD83C\uDDF2\uD83C\uDDED"],"","",["flag-mh"],2,59,15,0],
		"1f1f2-1f1f0":[["\uD83C\uDDF2\uD83C\uDDF0"],"","",["flag-mk"],3,0,15,0],
		"1f1f2-1f1f1":[["\uD83C\uDDF2\uD83C\uDDF1"],"","",["flag-ml"],3,1,15,0],
		"1f1f2-1f1f2":[["\uD83C\uDDF2\uD83C\uDDF2"],"","",["flag-mm"],3,2,15,0],
		"1f1f2-1f1f3":[["\uD83C\uDDF2\uD83C\uDDF3"],"","",["flag-mn"],3,3,15,0],
		"1f1f2-1f1f4":[["\uD83C\uDDF2\uD83C\uDDF4"],"","",["flag-mo"],3,4,15,0],
		"1f1f2-1f1f5":[["\uD83C\uDDF2\uD83C\uDDF5"],"","",["flag-mp"],3,5,15,0],
		"1f1f2-1f1f6":[["\uD83C\uDDF2\uD83C\uDDF6"],"","",["flag-mq"],3,6,15,0],
		"1f1f2-1f1f7":[["\uD83C\uDDF2\uD83C\uDDF7"],"","",["flag-mr"],3,7,15,0],
		"1f1f2-1f1f8":[["\uD83C\uDDF2\uD83C\uDDF8"],"","",["flag-ms"],3,8,15,0],
		"1f1f2-1f1f9":[["\uD83C\uDDF2\uD83C\uDDF9"],"","",["flag-mt"],3,9,15,0],
		"1f1f2-1f1fa":[["\uD83C\uDDF2\uD83C\uDDFA"],"","",["flag-mu"],3,10,15,0],
		"1f1f2-1f1fb":[["\uD83C\uDDF2\uD83C\uDDFB"],"","",["flag-mv"],3,11,15,0],
		"1f1f2-1f1fc":[["\uD83C\uDDF2\uD83C\uDDFC"],"","",["flag-mw"],3,12,15,0],
		"1f1f2-1f1fd":[["\uD83C\uDDF2\uD83C\uDDFD"],"","",["flag-mx"],3,13,15,0],
		"1f1f2-1f1fe":[["\uD83C\uDDF2\uD83C\uDDFE"],"","",["flag-my"],3,14,15,0],
		"1f1f2-1f1ff":[["\uD83C\uDDF2\uD83C\uDDFF"],"","",["flag-mz"],3,15,15,0],
		"1f1f3-1f1e6":[["\uD83C\uDDF3\uD83C\uDDE6"],"","",["flag-na"],3,16,15,0],
		"1f1f3-1f1e8":[["\uD83C\uDDF3\uD83C\uDDE8"],"","",["flag-nc"],3,17,15,0],
		"1f1f3-1f1ea":[["\uD83C\uDDF3\uD83C\uDDEA"],"","",["flag-ne"],3,18,15,0],
		"1f1f3-1f1eb":[["\uD83C\uDDF3\uD83C\uDDEB"],"","",["flag-nf"],3,19,15,0],
		"1f1f3-1f1ec":[["\uD83C\uDDF3\uD83C\uDDEC"],"","",["flag-ng"],3,20,15,0],
		"1f1f3-1f1ee":[["\uD83C\uDDF3\uD83C\uDDEE"],"","",["flag-ni"],3,21,15,0],
		"1f1f3-1f1f1":[["\uD83C\uDDF3\uD83C\uDDF1"],"","",["flag-nl"],3,22,15,0],
		"1f1f3-1f1f4":[["\uD83C\uDDF3\uD83C\uDDF4"],"","",["flag-no"],3,23,15,0],
		"1f1f3-1f1f5":[["\uD83C\uDDF3\uD83C\uDDF5"],"","",["flag-np"],3,24,15,0],
		"1f1f3-1f1f7":[["\uD83C\uDDF3\uD83C\uDDF7"],"","",["flag-nr"],3,25,15,0],
		"1f1f3-1f1fa":[["\uD83C\uDDF3\uD83C\uDDFA"],"","",["flag-nu"],3,26,15,0],
		"1f1f3-1f1ff":[["\uD83C\uDDF3\uD83C\uDDFF"],"","",["flag-nz"],3,27,15,0],
		"1f1f4-1f1f2":[["\uD83C\uDDF4\uD83C\uDDF2"],"","",["flag-om"],3,28,15,0],
		"1f1f5-1f1e6":[["\uD83C\uDDF5\uD83C\uDDE6"],"","",["flag-pa"],3,29,15,0],
		"1f1f5-1f1ea":[["\uD83C\uDDF5\uD83C\uDDEA"],"","",["flag-pe"],3,30,15,0],
		"1f1f5-1f1eb":[["\uD83C\uDDF5\uD83C\uDDEB"],"","",["flag-pf"],3,31,15,0],
		"1f1f5-1f1ec":[["\uD83C\uDDF5\uD83C\uDDEC"],"","",["flag-pg"],3,32,15,0],
		"1f1f5-1f1ed":[["\uD83C\uDDF5\uD83C\uDDED"],"","",["flag-ph"],3,33,15,0],
		"1f1f5-1f1f0":[["\uD83C\uDDF5\uD83C\uDDF0"],"","",["flag-pk"],3,34,15,0],
		"1f1f5-1f1f1":[["\uD83C\uDDF5\uD83C\uDDF1"],"","",["flag-pl"],3,35,15,0],
		"1f1f5-1f1f2":[["\uD83C\uDDF5\uD83C\uDDF2"],"","",["flag-pm"],3,36,15,0],
		"1f1f5-1f1f3":[["\uD83C\uDDF5\uD83C\uDDF3"],"","",["flag-pn"],3,37,15,0],
		"1f1f5-1f1f7":[["\uD83C\uDDF5\uD83C\uDDF7"],"","",["flag-pr"],3,38,15,0],
		"1f1f5-1f1f8":[["\uD83C\uDDF5\uD83C\uDDF8"],"","",["flag-ps"],3,39,15,0],
		"1f1f5-1f1f9":[["\uD83C\uDDF5\uD83C\uDDF9"],"","",["flag-pt"],3,40,15,0],
		"1f1f5-1f1fc":[["\uD83C\uDDF5\uD83C\uDDFC"],"","",["flag-pw"],3,41,15,0],
		"1f1f5-1f1fe":[["\uD83C\uDDF5\uD83C\uDDFE"],"","",["flag-py"],3,42,15,0],
		"1f1f6-1f1e6":[["\uD83C\uDDF6\uD83C\uDDE6"],"","",["flag-qa"],3,43,15,0],
		"1f1f7-1f1ea":[["\uD83C\uDDF7\uD83C\uDDEA"],"","",["flag-re"],3,44,15,0],
		"1f1f7-1f1f4":[["\uD83C\uDDF7\uD83C\uDDF4"],"","",["flag-ro"],3,45,15,0],
		"1f1f7-1f1f8":[["\uD83C\uDDF7\uD83C\uDDF8"],"","",["flag-rs"],3,46,15,0],
		"1f1f7-1f1fa":[["\uD83C\uDDF7\uD83C\uDDFA"],"\uE512","\uDBB9\uDCEC",["ru","flag-ru"],3,47,15,0],
		"1f1f7-1f1fc":[["\uD83C\uDDF7\uD83C\uDDFC"],"","",["flag-rw"],3,48,15,0],
		"1f1f8-1f1e6":[["\uD83C\uDDF8\uD83C\uDDE6"],"","",["flag-sa"],3,49,15,0],
		"1f1f8-1f1e7":[["\uD83C\uDDF8\uD83C\uDDE7"],"","",["flag-sb"],3,50,15,0],
		"1f1f8-1f1e8":[["\uD83C\uDDF8\uD83C\uDDE8"],"","",["flag-sc"],3,51,15,0],
		"1f1f8-1f1e9":[["\uD83C\uDDF8\uD83C\uDDE9"],"","",["flag-sd"],3,52,15,0],
		"1f1f8-1f1ea":[["\uD83C\uDDF8\uD83C\uDDEA"],"","",["flag-se"],3,53,15,0],
		"1f1f8-1f1ec":[["\uD83C\uDDF8\uD83C\uDDEC"],"","",["flag-sg"],3,54,15,0],
		"1f1f8-1f1ed":[["\uD83C\uDDF8\uD83C\uDDED"],"","",["flag-sh"],3,55,15,0],
		"1f1f8-1f1ee":[["\uD83C\uDDF8\uD83C\uDDEE"],"","",["flag-si"],3,56,15,0],
		"1f1f8-1f1ef":[["\uD83C\uDDF8\uD83C\uDDEF"],"","",["flag-sj"],3,57,15,0],
		"1f1f8-1f1f0":[["\uD83C\uDDF8\uD83C\uDDF0"],"","",["flag-sk"],3,58,15,0],
		"1f1f8-1f1f1":[["\uD83C\uDDF8\uD83C\uDDF1"],"","",["flag-sl"],3,59,15,0],
		"1f1f8-1f1f2":[["\uD83C\uDDF8\uD83C\uDDF2"],"","",["flag-sm"],4,0,15,0],
		"1f1f8-1f1f3":[["\uD83C\uDDF8\uD83C\uDDF3"],"","",["flag-sn"],4,1,15,0],
		"1f1f8-1f1f4":[["\uD83C\uDDF8\uD83C\uDDF4"],"","",["flag-so"],4,2,15,0],
		"1f1f8-1f1f7":[["\uD83C\uDDF8\uD83C\uDDF7"],"","",["flag-sr"],4,3,15,0],
		"1f1f8-1f1f8":[["\uD83C\uDDF8\uD83C\uDDF8"],"","",["flag-ss"],4,4,15,0],
		"1f1f8-1f1f9":[["\uD83C\uDDF8\uD83C\uDDF9"],"","",["flag-st"],4,5,15,0],
		"1f1f8-1f1fb":[["\uD83C\uDDF8\uD83C\uDDFB"],"","",["flag-sv"],4,6,15,0],
		"1f1f8-1f1fd":[["\uD83C\uDDF8\uD83C\uDDFD"],"","",["flag-sx"],4,7,15,0],
		"1f1f8-1f1fe":[["\uD83C\uDDF8\uD83C\uDDFE"],"","",["flag-sy"],4,8,15,0],
		"1f1f8-1f1ff":[["\uD83C\uDDF8\uD83C\uDDFF"],"","",["flag-sz"],4,9,15,0],
		"1f1f9-1f1e6":[["\uD83C\uDDF9\uD83C\uDDE6"],"","",["flag-ta"],4,10,15,0],
		"1f1f9-1f1e8":[["\uD83C\uDDF9\uD83C\uDDE8"],"","",["flag-tc"],4,11,15,0],
		"1f1f9-1f1e9":[["\uD83C\uDDF9\uD83C\uDDE9"],"","",["flag-td"],4,12,15,0],
		"1f1f9-1f1eb":[["\uD83C\uDDF9\uD83C\uDDEB"],"","",["flag-tf"],4,13,15,0],
		"1f1f9-1f1ec":[["\uD83C\uDDF9\uD83C\uDDEC"],"","",["flag-tg"],4,14,15,0],
		"1f1f9-1f1ed":[["\uD83C\uDDF9\uD83C\uDDED"],"","",["flag-th"],4,15,15,0],
		"1f1f9-1f1ef":[["\uD83C\uDDF9\uD83C\uDDEF"],"","",["flag-tj"],4,16,15,0],
		"1f1f9-1f1f0":[["\uD83C\uDDF9\uD83C\uDDF0"],"","",["flag-tk"],4,17,15,0],
		"1f1f9-1f1f1":[["\uD83C\uDDF9\uD83C\uDDF1"],"","",["flag-tl"],4,18,15,0],
		"1f1f9-1f1f2":[["\uD83C\uDDF9\uD83C\uDDF2"],"","",["flag-tm"],4,19,15,0],
		"1f1f9-1f1f3":[["\uD83C\uDDF9\uD83C\uDDF3"],"","",["flag-tn"],4,20,15,0],
		"1f1f9-1f1f4":[["\uD83C\uDDF9\uD83C\uDDF4"],"","",["flag-to"],4,21,15,0],
		"1f1f9-1f1f7":[["\uD83C\uDDF9\uD83C\uDDF7"],"","",["flag-tr"],4,22,15,0],
		"1f1f9-1f1f9":[["\uD83C\uDDF9\uD83C\uDDF9"],"","",["flag-tt"],4,23,15,0],
		"1f1f9-1f1fb":[["\uD83C\uDDF9\uD83C\uDDFB"],"","",["flag-tv"],4,24,15,0],
		"1f1f9-1f1fc":[["\uD83C\uDDF9\uD83C\uDDFC"],"","",["flag-tw"],4,25,15,0],
		"1f1f9-1f1ff":[["\uD83C\uDDF9\uD83C\uDDFF"],"","",["flag-tz"],4,26,15,0],
		"1f1fa-1f1e6":[["\uD83C\uDDFA\uD83C\uDDE6"],"","",["flag-ua"],4,27,15,0],
		"1f1fa-1f1ec":[["\uD83C\uDDFA\uD83C\uDDEC"],"","",["flag-ug"],4,28,15,0],
		"1f1fa-1f1f2":[["\uD83C\uDDFA\uD83C\uDDF2"],"","",["flag-um"],4,29,15,0],
		"1f1fa-1f1f3":[["\uD83C\uDDFA\uD83C\uDDF3"],"","",["flag-un"],4,30,15,0],
		"1f1fa-1f1f8":[["\uD83C\uDDFA\uD83C\uDDF8"],"\uE50C","\uDBB9\uDCE6",["us","flag-us"],4,31,15,0],
		"1f1fa-1f1fe":[["\uD83C\uDDFA\uD83C\uDDFE"],"","",["flag-uy"],4,32,15,0],
		"1f1fa-1f1ff":[["\uD83C\uDDFA\uD83C\uDDFF"],"","",["flag-uz"],4,33,15,0],
		"1f1fb-1f1e6":[["\uD83C\uDDFB\uD83C\uDDE6"],"","",["flag-va"],4,34,15,0],
		"1f1fb-1f1e8":[["\uD83C\uDDFB\uD83C\uDDE8"],"","",["flag-vc"],4,35,15,0],
		"1f1fb-1f1ea":[["\uD83C\uDDFB\uD83C\uDDEA"],"","",["flag-ve"],4,36,15,0],
		"1f1fb-1f1ec":[["\uD83C\uDDFB\uD83C\uDDEC"],"","",["flag-vg"],4,37,15,0],
		"1f1fb-1f1ee":[["\uD83C\uDDFB\uD83C\uDDEE"],"","",["flag-vi"],4,38,15,0],
		"1f1fb-1f1f3":[["\uD83C\uDDFB\uD83C\uDDF3"],"","",["flag-vn"],4,39,15,0],
		"1f1fb-1f1fa":[["\uD83C\uDDFB\uD83C\uDDFA"],"","",["flag-vu"],4,40,15,0],
		"1f1fc-1f1eb":[["\uD83C\uDDFC\uD83C\uDDEB"],"","",["flag-wf"],4,41,15,0],
		"1f1fc-1f1f8":[["\uD83C\uDDFC\uD83C\uDDF8"],"","",["flag-ws"],4,42,15,0],
		"1f1fd-1f1f0":[["\uD83C\uDDFD\uD83C\uDDF0"],"","",["flag-xk"],4,43,15,0],
		"1f1fe-1f1ea":[["\uD83C\uDDFE\uD83C\uDDEA"],"","",["flag-ye"],4,44,15,0],
		"1f1fe-1f1f9":[["\uD83C\uDDFE\uD83C\uDDF9"],"","",["flag-yt"],4,45,15,0],
		"1f1ff-1f1e6":[["\uD83C\uDDFF\uD83C\uDDE6"],"","",["flag-za"],4,46,15,0],
		"1f1ff-1f1f2":[["\uD83C\uDDFF\uD83C\uDDF2"],"","",["flag-zm"],4,47,15,0],
		"1f1ff-1f1fc":[["\uD83C\uDDFF\uD83C\uDDFC"],"","",["flag-zw"],4,48,15,0],
		"1f201":[["\uD83C\uDE01"],"\uE203","\uDBBA\uDF24",["koko"],4,49,15,0],
		"1f202-fe0f":[["\uD83C\uDE02\uFE0F","\uD83C\uDE02"],"\uE228","\uDBBA\uDF3F",["sa"],4,50,15,0],
		"1f21a":[["\uD83C\uDE1A"],"\uE216","\uDBBA\uDF3A",["u7121"],4,51,15,0],
		"1f22f":[["\uD83C\uDE2F"],"\uE22C","\uDBBA\uDF40",["u6307"],4,52,15,0],
		"1f232":[["\uD83C\uDE32"],"","\uDBBA\uDF2E",["u7981"],4,53,15,0],
		"1f233":[["\uD83C\uDE33"],"\uE22B","\uDBBA\uDF2F",["u7a7a"],4,54,15,0],
		"1f234":[["\uD83C\uDE34"],"","\uDBBA\uDF30",["u5408"],4,55,15,0],
		"1f235":[["\uD83C\uDE35"],"\uE22A","\uDBBA\uDF31",["u6e80"],4,56,15,0],
		"1f236":[["\uD83C\uDE36"],"\uE215","\uDBBA\uDF39",["u6709"],4,57,15,0],
		"1f237-fe0f":[["\uD83C\uDE37\uFE0F","\uD83C\uDE37"],"\uE217","\uDBBA\uDF3B",["u6708"],4,58,15,0],
		"1f238":[["\uD83C\uDE38"],"\uE218","\uDBBA\uDF3C",["u7533"],4,59,15,0],
		"1f239":[["\uD83C\uDE39"],"\uE227","\uDBBA\uDF3E",["u5272"],5,0,15,0],
		"1f23a":[["\uD83C\uDE3A"],"\uE22D","\uDBBA\uDF41",["u55b6"],5,1,15,0],
		"1f250":[["\uD83C\uDE50"],"\uE226","\uDBBA\uDF3D",["ideograph_advantage"],5,2,15,0],
		"1f251":[["\uD83C\uDE51"],"","\uDBBA\uDF50",["accept"],5,3,15,0],
		"1f300":[["\uD83C\uDF00"],"\uE443","\uDBB8\uDC05",["cyclone"],5,4,15,0],
		"1f301":[["\uD83C\uDF01"],"","\uDBB8\uDC06",["foggy"],5,5,15,0],
		"1f302":[["\uD83C\uDF02"],"\uE43C","\uDBB8\uDC07",["closed_umbrella"],5,6,15,0],
		"1f303":[["\uD83C\uDF03"],"\uE44B","\uDBB8\uDC08",["night_with_stars"],5,7,15,0],
		"1f304":[["\uD83C\uDF04"],"\uE04D","\uDBB8\uDC09",["sunrise_over_mountains"],5,8,15,0],
		"1f305":[["\uD83C\uDF05"],"\uE449","\uDBB8\uDC0A",["sunrise"],5,9,15,0],
		"1f306":[["\uD83C\uDF06"],"\uE146","\uDBB8\uDC0B",["city_sunset"],5,10,15,0],
		"1f307":[["\uD83C\uDF07"],"\uE44A","\uDBB8\uDC0C",["city_sunrise"],5,11,15,0],
		"1f308":[["\uD83C\uDF08"],"\uE44C","\uDBB8\uDC0D",["rainbow"],5,12,15,0],
		"1f309":[["\uD83C\uDF09"],"","\uDBB8\uDC10",["bridge_at_night"],5,13,15,0],
		"1f30a":[["\uD83C\uDF0A"],"\uE43E","\uDBB8\uDC38",["ocean"],5,14,15,0],
		"1f30b":[["\uD83C\uDF0B"],"","\uDBB8\uDC3A",["volcano"],5,15,15,0],
		"1f30c":[["\uD83C\uDF0C"],"","\uDBB8\uDC3B",["milky_way"],5,16,15,0],
		"1f30d":[["\uD83C\uDF0D"],"","",["earth_africa"],5,17,15,0],
		"1f30e":[["\uD83C\uDF0E"],"","",["earth_americas"],5,18,15,0],
		"1f30f":[["\uD83C\uDF0F"],"","\uDBB8\uDC39",["earth_asia"],5,19,15,0],
		"1f310":[["\uD83C\uDF10"],"","",["globe_with_meridians"],5,20,15,0],
		"1f311":[["\uD83C\uDF11"],"","\uDBB8\uDC11",["new_moon"],5,21,15,0],
		"1f312":[["\uD83C\uDF12"],"","",["waxing_crescent_moon"],5,22,15,0],
		"1f313":[["\uD83C\uDF13"],"","\uDBB8\uDC13",["first_quarter_moon"],5,23,15,0],
		"1f314":[["\uD83C\uDF14"],"","\uDBB8\uDC12",["moon","waxing_gibbous_moon"],5,24,15,0],
		"1f315":[["\uD83C\uDF15"],"","\uDBB8\uDC15",["full_moon"],5,25,15,0],
		"1f316":[["\uD83C\uDF16"],"","",["waning_gibbous_moon"],5,26,15,0],
		"1f317":[["\uD83C\uDF17"],"","",["last_quarter_moon"],5,27,15,0],
		"1f318":[["\uD83C\uDF18"],"","",["waning_crescent_moon"],5,28,15,0],
		"1f319":[["\uD83C\uDF19"],"\uE04C","\uDBB8\uDC14",["crescent_moon"],5,29,15,0],
		"1f31a":[["\uD83C\uDF1A"],"","",["new_moon_with_face"],5,30,15,0],
		"1f31b":[["\uD83C\uDF1B"],"","\uDBB8\uDC16",["first_quarter_moon_with_face"],5,31,15,0],
		"1f31c":[["\uD83C\uDF1C"],"","",["last_quarter_moon_with_face"],5,32,15,0],
		"1f31d":[["\uD83C\uDF1D"],"","",["full_moon_with_face"],5,33,15,0],
		"1f31e":[["\uD83C\uDF1E"],"","",["sun_with_face"],5,34,15,0],
		"1f31f":[["\uD83C\uDF1F"],"\uE335","\uDBBA\uDF69",["star2"],5,35,15,0],
		"1f320":[["\uD83C\uDF20"],"","\uDBBA\uDF6A",["stars"],5,36,15,0],
		"1f321-fe0f":[["\uD83C\uDF21\uFE0F","\uD83C\uDF21"],"","",["thermometer"],5,37,15,0],
		"1f324-fe0f":[["\uD83C\uDF24\uFE0F","\uD83C\uDF24"],"","",["mostly_sunny","sun_small_cloud"],5,38,15,0],
		"1f325-fe0f":[["\uD83C\uDF25\uFE0F","\uD83C\uDF25"],"","",["barely_sunny","sun_behind_cloud"],5,39,15,0],
		"1f326-fe0f":[["\uD83C\uDF26\uFE0F","\uD83C\uDF26"],"","",["partly_sunny_rain","sun_behind_rain_cloud"],5,40,15,0],
		"1f327-fe0f":[["\uD83C\uDF27\uFE0F","\uD83C\uDF27"],"","",["rain_cloud"],5,41,15,0],
		"1f328-fe0f":[["\uD83C\uDF28\uFE0F","\uD83C\uDF28"],"","",["snow_cloud"],5,42,15,0],
		"1f329-fe0f":[["\uD83C\uDF29\uFE0F","\uD83C\uDF29"],"","",["lightning","lightning_cloud"],5,43,15,0],
		"1f32a-fe0f":[["\uD83C\uDF2A\uFE0F","\uD83C\uDF2A"],"","",["tornado","tornado_cloud"],5,44,15,0],
		"1f32b-fe0f":[["\uD83C\uDF2B\uFE0F","\uD83C\uDF2B"],"","",["fog"],5,45,15,0],
		"1f32c-fe0f":[["\uD83C\uDF2C\uFE0F","\uD83C\uDF2C"],"","",["wind_blowing_face"],5,46,15,0],
		"1f32d":[["\uD83C\uDF2D"],"","",["hotdog"],5,47,15,0],
		"1f32e":[["\uD83C\uDF2E"],"","",["taco"],5,48,15,0],
		"1f32f":[["\uD83C\uDF2F"],"","",["burrito"],5,49,15,0],
		"1f330":[["\uD83C\uDF30"],"","\uDBB8\uDC4C",["chestnut"],5,50,15,0],
		"1f331":[["\uD83C\uDF31"],"","\uDBB8\uDC3E",["seedling"],5,51,15,0],
		"1f332":[["\uD83C\uDF32"],"","",["evergreen_tree"],5,52,15,0],
		"1f333":[["\uD83C\uDF33"],"","",["deciduous_tree"],5,53,15,0],
		"1f334":[["\uD83C\uDF34"],"\uE307","\uDBB8\uDC47",["palm_tree"],5,54,15,0],
		"1f335":[["\uD83C\uDF35"],"\uE308","\uDBB8\uDC48",["cactus"],5,55,15,0],
		"1f336-fe0f":[["\uD83C\uDF36\uFE0F","\uD83C\uDF36"],"","",["hot_pepper"],5,56,15,0],
		"1f337":[["\uD83C\uDF37"],"\uE304","\uDBB8\uDC3D",["tulip"],5,57,15,0],
		"1f338":[["\uD83C\uDF38"],"\uE030","\uDBB8\uDC40",["cherry_blossom"],5,58,15,0],
		"1f339":[["\uD83C\uDF39"],"\uE032","\uDBB8\uDC41",["rose"],5,59,15,0],
		"1f33a":[["\uD83C\uDF3A"],"\uE303","\uDBB8\uDC45",["hibiscus"],6,0,15,0],
		"1f33b":[["\uD83C\uDF3B"],"\uE305","\uDBB8\uDC46",["sunflower"],6,1,15,0],
		"1f33c":[["\uD83C\uDF3C"],"","\uDBB8\uDC4D",["blossom"],6,2,15,0],
		"1f33d":[["\uD83C\uDF3D"],"","\uDBB8\uDC4A",["corn"],6,3,15,0],
		"1f33e":[["\uD83C\uDF3E"],"\uE444","\uDBB8\uDC49",["ear_of_rice"],6,4,15,0],
		"1f33f":[["\uD83C\uDF3F"],"","\uDBB8\uDC4E",["herb"],6,5,15,0],
		"1f340":[["\uD83C\uDF40"],"\uE110","\uDBB8\uDC3C",["four_leaf_clover"],6,6,15,0],
		"1f341":[["\uD83C\uDF41"],"\uE118","\uDBB8\uDC3F",["maple_leaf"],6,7,15,0],
		"1f342":[["\uD83C\uDF42"],"\uE119","\uDBB8\uDC42",["fallen_leaf"],6,8,15,0],
		"1f343":[["\uD83C\uDF43"],"\uE447","\uDBB8\uDC43",["leaves"],6,9,15,0],
		"1f344":[["\uD83C\uDF44"],"","\uDBB8\uDC4B",["mushroom"],6,10,15,0],
		"1f345":[["\uD83C\uDF45"],"\uE349","\uDBB8\uDC55",["tomato"],6,11,15,0],
		"1f346":[["\uD83C\uDF46"],"\uE34A","\uDBB8\uDC56",["eggplant"],6,12,15,0],
		"1f347":[["\uD83C\uDF47"],"","\uDBB8\uDC59",["grapes"],6,13,15,0],
		"1f348":[["\uD83C\uDF48"],"","\uDBB8\uDC57",["melon"],6,14,15,0],
		"1f349":[["\uD83C\uDF49"],"\uE348","\uDBB8\uDC54",["watermelon"],6,15,15,0],
		"1f34a":[["\uD83C\uDF4A"],"\uE346","\uDBB8\uDC52",["tangerine"],6,16,15,0],
		"1f34b":[["\uD83C\uDF4B"],"","",["lemon"],6,17,15,0],
		"1f34c":[["\uD83C\uDF4C"],"","\uDBB8\uDC50",["banana"],6,18,15,0],
		"1f34d":[["\uD83C\uDF4D"],"","\uDBB8\uDC58",["pineapple"],6,19,15,0],
		"1f34e":[["\uD83C\uDF4E"],"\uE345","\uDBB8\uDC51",["apple"],6,20,15,0],
		"1f34f":[["\uD83C\uDF4F"],"","\uDBB8\uDC5B",["green_apple"],6,21,15,0],
		"1f350":[["\uD83C\uDF50"],"","",["pear"],6,22,15,0],
		"1f351":[["\uD83C\uDF51"],"","\uDBB8\uDC5A",["peach"],6,23,15,0],
		"1f352":[["\uD83C\uDF52"],"","\uDBB8\uDC4F",["cherries"],6,24,15,0],
		"1f353":[["\uD83C\uDF53"],"\uE347","\uDBB8\uDC53",["strawberry"],6,25,15,0],
		"1f354":[["\uD83C\uDF54"],"\uE120","\uDBBA\uDD60",["hamburger"],6,26,15,0],
		"1f355":[["\uD83C\uDF55"],"","\uDBBA\uDD75",["pizza"],6,27,15,0],
		"1f356":[["\uD83C\uDF56"],"","\uDBBA\uDD72",["meat_on_bone"],6,28,15,0],
		"1f357":[["\uD83C\uDF57"],"","\uDBBA\uDD76",["poultry_leg"],6,29,15,0],
		"1f358":[["\uD83C\uDF58"],"\uE33D","\uDBBA\uDD69",["rice_cracker"],6,30,15,0],
		"1f359":[["\uD83C\uDF59"],"\uE342","\uDBBA\uDD61",["rice_ball"],6,31,15,0],
		"1f35a":[["\uD83C\uDF5A"],"\uE33E","\uDBBA\uDD6A",["rice"],6,32,15,0],
		"1f35b":[["\uD83C\uDF5B"],"\uE341","\uDBBA\uDD6C",["curry"],6,33,15,0],
		"1f35c":[["\uD83C\uDF5C"],"\uE340","\uDBBA\uDD63",["ramen"],6,34,15,0],
		"1f35d":[["\uD83C\uDF5D"],"\uE33F","\uDBBA\uDD6B",["spaghetti"],6,35,15,0],
		"1f35e":[["\uD83C\uDF5E"],"\uE339","\uDBBA\uDD64",["bread"],6,36,15,0],
		"1f35f":[["\uD83C\uDF5F"],"\uE33B","\uDBBA\uDD67",["fries"],6,37,15,0],
		"1f360":[["\uD83C\uDF60"],"","\uDBBA\uDD74",["sweet_potato"],6,38,15,0],
		"1f361":[["\uD83C\uDF61"],"\uE33C","\uDBBA\uDD68",["dango"],6,39,15,0],
		"1f362":[["\uD83C\uDF62"],"\uE343","\uDBBA\uDD6D",["oden"],6,40,15,0],
		"1f363":[["\uD83C\uDF63"],"\uE344","\uDBBA\uDD6E",["sushi"],6,41,15,0],
		"1f364":[["\uD83C\uDF64"],"","\uDBBA\uDD7F",["fried_shrimp"],6,42,15,0],
		"1f365":[["\uD83C\uDF65"],"","\uDBBA\uDD73",["fish_cake"],6,43,15,0],
		"1f366":[["\uD83C\uDF66"],"\uE33A","\uDBBA\uDD66",["icecream"],6,44,15,0],
		"1f367":[["\uD83C\uDF67"],"\uE43F","\uDBBA\uDD71",["shaved_ice"],6,45,15,0],
		"1f368":[["\uD83C\uDF68"],"","\uDBBA\uDD77",["ice_cream"],6,46,15,0],
		"1f369":[["\uD83C\uDF69"],"","\uDBBA\uDD78",["doughnut"],6,47,15,0],
		"1f36a":[["\uD83C\uDF6A"],"","\uDBBA\uDD79",["cookie"],6,48,15,0],
		"1f36b":[["\uD83C\uDF6B"],"","\uDBBA\uDD7A",["chocolate_bar"],6,49,15,0],
		"1f36c":[["\uD83C\uDF6C"],"","\uDBBA\uDD7B",["candy"],6,50,15,0],
		"1f36d":[["\uD83C\uDF6D"],"","\uDBBA\uDD7C",["lollipop"],6,51,15,0],
		"1f36e":[["\uD83C\uDF6E"],"","\uDBBA\uDD7D",["custard"],6,52,15,0],
		"1f36f":[["\uD83C\uDF6F"],"","\uDBBA\uDD7E",["honey_pot"],6,53,15,0],
		"1f370":[["\uD83C\uDF70"],"\uE046","\uDBBA\uDD62",["cake"],6,54,15,0],
		"1f371":[["\uD83C\uDF71"],"\uE34C","\uDBBA\uDD6F",["bento"],6,55,15,0],
		"1f372":[["\uD83C\uDF72"],"\uE34D","\uDBBA\uDD70",["stew"],6,56,15,0],
		"1f373":[["\uD83C\uDF73"],"\uE147","\uDBBA\uDD65",["fried_egg","cooking"],6,57,15,0],
		"1f374":[["\uD83C\uDF74"],"\uE043","\uDBBA\uDD80",["fork_and_knife"],6,58,15,0],
		"1f375":[["\uD83C\uDF75"],"\uE338","\uDBBA\uDD84",["tea"],6,59,15,0],
		"1f376":[["\uD83C\uDF76"],"\uE30B","\uDBBA\uDD85",["sake"],7,0,15,0],
		"1f377":[["\uD83C\uDF77"],"","\uDBBA\uDD86",["wine_glass"],7,1,15,0],
		"1f378":[["\uD83C\uDF78"],"\uE044","\uDBBA\uDD82",["cocktail"],7,2,15,0],
		"1f379":[["\uD83C\uDF79"],"","\uDBBA\uDD88",["tropical_drink"],7,3,15,0],
		"1f37a":[["\uD83C\uDF7A"],"\uE047","\uDBBA\uDD83",["beer"],7,4,15,0],
		"1f37b":[["\uD83C\uDF7B"],"\uE30C","\uDBBA\uDD87",["beers"],7,5,15,0],
		"1f37c":[["\uD83C\uDF7C"],"","",["baby_bottle"],7,6,15,0],
		"1f37d-fe0f":[["\uD83C\uDF7D\uFE0F","\uD83C\uDF7D"],"","",["knife_fork_plate"],7,7,15,0],
		"1f37e":[["\uD83C\uDF7E"],"","",["champagne"],7,8,15,0],
		"1f37f":[["\uD83C\uDF7F"],"","",["popcorn"],7,9,15,0],
		"1f380":[["\uD83C\uDF80"],"\uE314","\uDBB9\uDD0F",["ribbon"],7,10,15,0],
		"1f381":[["\uD83C\uDF81"],"\uE112","\uDBB9\uDD10",["gift"],7,11,15,0],
		"1f382":[["\uD83C\uDF82"],"\uE34B","\uDBB9\uDD11",["birthday"],7,12,15,0],
		"1f383":[["\uD83C\uDF83"],"\uE445","\uDBB9\uDD1F",["jack_o_lantern"],7,13,15,0],
		"1f384":[["\uD83C\uDF84"],"\uE033","\uDBB9\uDD12",["christmas_tree"],7,14,15,0],
		"1f385":[["\uD83C\uDF85"],"\uE448","\uDBB9\uDD13",["santa"],7,15,15,0],
		"1f386":[["\uD83C\uDF86"],"\uE117","\uDBB9\uDD15",["fireworks"],7,21,15,0],
		"1f387":[["\uD83C\uDF87"],"\uE440","\uDBB9\uDD1D",["sparkler"],7,22,15,0],
		"1f388":[["\uD83C\uDF88"],"\uE310","\uDBB9\uDD16",["balloon"],7,23,15,0],
		"1f389":[["\uD83C\uDF89"],"\uE312","\uDBB9\uDD17",["tada"],7,24,15,0],
		"1f38a":[["\uD83C\uDF8A"],"","\uDBB9\uDD20",["confetti_ball"],7,25,15,0],
		"1f38b":[["\uD83C\uDF8B"],"","\uDBB9\uDD21",["tanabata_tree"],7,26,15,0],
		"1f38c":[["\uD83C\uDF8C"],"\uE143","\uDBB9\uDD14",["crossed_flags"],7,27,15,0],
		"1f38d":[["\uD83C\uDF8D"],"\uE436","\uDBB9\uDD18",["bamboo"],7,28,15,0],
		"1f38e":[["\uD83C\uDF8E"],"\uE438","\uDBB9\uDD19",["dolls"],7,29,15,0],
		"1f38f":[["\uD83C\uDF8F"],"\uE43B","\uDBB9\uDD1C",["flags"],7,30,15,0],
		"1f390":[["\uD83C\uDF90"],"\uE442","\uDBB9\uDD1E",["wind_chime"],7,31,15,0],
		"1f391":[["\uD83C\uDF91"],"\uE446","\uDBB8\uDC17",["rice_scene"],7,32,15,0],
		"1f392":[["\uD83C\uDF92"],"\uE43A","\uDBB9\uDD1B",["school_satchel"],7,33,15,0],
		"1f393":[["\uD83C\uDF93"],"\uE439","\uDBB9\uDD1A",["mortar_board"],7,34,15,0],
		"1f396-fe0f":[["\uD83C\uDF96\uFE0F","\uD83C\uDF96"],"","",["medal"],7,35,15,0],
		"1f397-fe0f":[["\uD83C\uDF97\uFE0F","\uD83C\uDF97"],"","",["reminder_ribbon"],7,36,15,0],
		"1f399-fe0f":[["\uD83C\uDF99\uFE0F","\uD83C\uDF99"],"","",["studio_microphone"],7,37,15,0],
		"1f39a-fe0f":[["\uD83C\uDF9A\uFE0F","\uD83C\uDF9A"],"","",["level_slider"],7,38,15,0],
		"1f39b-fe0f":[["\uD83C\uDF9B\uFE0F","\uD83C\uDF9B"],"","",["control_knobs"],7,39,15,0],
		"1f39e-fe0f":[["\uD83C\uDF9E\uFE0F","\uD83C\uDF9E"],"","",["film_frames"],7,40,15,0],
		"1f39f-fe0f":[["\uD83C\uDF9F\uFE0F","\uD83C\uDF9F"],"","",["admission_tickets"],7,41,15,0],
		"1f3a0":[["\uD83C\uDFA0"],"","\uDBB9\uDFFC",["carousel_horse"],7,42,15,0],
		"1f3a1":[["\uD83C\uDFA1"],"\uE124","\uDBB9\uDFFD",["ferris_wheel"],7,43,15,0],
		"1f3a2":[["\uD83C\uDFA2"],"\uE433","\uDBB9\uDFFE",["roller_coaster"],7,44,15,0],
		"1f3a3":[["\uD83C\uDFA3"],"","\uDBB9\uDFFF",["fishing_pole_and_fish"],7,45,15,0],
		"1f3a4":[["\uD83C\uDFA4"],"\uE03C","\uDBBA\uDC00",["microphone"],7,46,15,0],
		"1f3a5":[["\uD83C\uDFA5"],"\uE03D","\uDBBA\uDC01",["movie_camera"],7,47,15,0],
		"1f3a6":[["\uD83C\uDFA6"],"\uE507","\uDBBA\uDC02",["cinema"],7,48,15,0],
		"1f3a7":[["\uD83C\uDFA7"],"\uE30A","\uDBBA\uDC03",["headphones"],7,49,15,0],
		"1f3a8":[["\uD83C\uDFA8"],"\uE502","\uDBBA\uDC04",["art"],7,50,15,0],
		"1f3a9":[["\uD83C\uDFA9"],"\uE503","\uDBBA\uDC05",["tophat"],7,51,15,0],
		"1f3aa":[["\uD83C\uDFAA"],"","\uDBBA\uDC06",["circus_tent"],7,52,15,0],
		"1f3ab":[["\uD83C\uDFAB"],"\uE125","\uDBBA\uDC07",["ticket"],7,53,15,0],
		"1f3ac":[["\uD83C\uDFAC"],"\uE324","\uDBBA\uDC08",["clapper"],7,54,15,0],
		"1f3ad":[["\uD83C\uDFAD"],"","\uDBBA\uDC09",["performing_arts"],7,55,15,0],
		"1f3ae":[["\uD83C\uDFAE"],"","\uDBBA\uDC0A",["video_game"],7,56,15,0],
		"1f3af":[["\uD83C\uDFAF"],"\uE130","\uDBBA\uDC0C",["dart"],7,57,15,0],
		"1f3b0":[["\uD83C\uDFB0"],"\uE133","\uDBBA\uDC0D",["slot_machine"],7,58,15,0],
		"1f3b1":[["\uD83C\uDFB1"],"\uE42C","\uDBBA\uDC0E",["8ball"],7,59,15,0],
		"1f3b2":[["\uD83C\uDFB2"],"","\uDBBA\uDC0F",["game_die"],8,0,15,0],
		"1f3b3":[["\uD83C\uDFB3"],"","\uDBBA\uDC10",["bowling"],8,1,15,0],
		"1f3b4":[["\uD83C\uDFB4"],"","\uDBBA\uDC11",["flower_playing_cards"],8,2,15,0],
		"1f3b5":[["\uD83C\uDFB5"],"\uE03E","\uDBBA\uDC13",["musical_note"],8,3,15,0],
		"1f3b6":[["\uD83C\uDFB6"],"\uE326","\uDBBA\uDC14",["notes"],8,4,15,0],
		"1f3b7":[["\uD83C\uDFB7"],"\uE040","\uDBBA\uDC15",["saxophone"],8,5,15,0],
		"1f3b8":[["\uD83C\uDFB8"],"\uE041","\uDBBA\uDC16",["guitar"],8,6,15,0],
		"1f3b9":[["\uD83C\uDFB9"],"","\uDBBA\uDC17",["musical_keyboard"],8,7,15,0],
		"1f3ba":[["\uD83C\uDFBA"],"\uE042","\uDBBA\uDC18",["trumpet"],8,8,15,0],
		"1f3bb":[["\uD83C\uDFBB"],"","\uDBBA\uDC19",["violin"],8,9,15,0],
		"1f3bc":[["\uD83C\uDFBC"],"","\uDBBA\uDC1A",["musical_score"],8,10,15,0],
		"1f3bd":[["\uD83C\uDFBD"],"","\uDBB9\uDFD0",["running_shirt_with_sash"],8,11,15,0],
		"1f3be":[["\uD83C\uDFBE"],"\uE015","\uDBB9\uDFD3",["tennis"],8,12,15,0],
		"1f3bf":[["\uD83C\uDFBF"],"\uE013","\uDBB9\uDFD5",["ski"],8,13,15,0],
		"1f3c0":[["\uD83C\uDFC0"],"\uE42A","\uDBB9\uDFD6",["basketball"],8,14,15,0],
		"1f3c1":[["\uD83C\uDFC1"],"\uE132","\uDBB9\uDFD7",["checkered_flag"],8,15,15,0],
		"1f3c2":[["\uD83C\uDFC2"],"","\uDBB9\uDFD8",["snowboarder"],8,16,15,0],
		"1f3c3-200d-2640-fe0f":[["\uD83C\uDFC3\u200D\u2640\uFE0F","\uD83C\uDFC3\u200D\u2640"],"","",["woman-running"],8,22,15,0],
		"1f3c3-200d-2642-fe0f":[["\uD83C\uDFC3\u200D\u2642\uFE0F","\uD83C\uDFC3\u200D\u2642","\uD83C\uDFC3"],"","",["man-running","runner","running"],8,28,15,0],
		"1f3c4-200d-2640-fe0f":[["\uD83C\uDFC4\u200D\u2640\uFE0F","\uD83C\uDFC4\u200D\u2640"],"","",["woman-surfing"],8,40,15,0],
		"1f3c4-200d-2642-fe0f":[["\uD83C\uDFC4\u200D\u2642\uFE0F","\uD83C\uDFC4\u200D\u2642","\uD83C\uDFC4"],"","",["man-surfing","surfer"],8,46,15,0],
		"1f3c5":[["\uD83C\uDFC5"],"","",["sports_medal"],8,58,15,0],
		"1f3c6":[["\uD83C\uDFC6"],"\uE131","\uDBB9\uDFDB",["trophy"],8,59,15,0],
		"1f3c7":[["\uD83C\uDFC7"],"","",["horse_racing"],9,0,15,0],
		"1f3c8":[["\uD83C\uDFC8"],"\uE42B","\uDBB9\uDFDD",["football"],9,6,15,0],
		"1f3c9":[["\uD83C\uDFC9"],"","",["rugby_football"],9,7,15,0],
		"1f3ca-200d-2640-fe0f":[["\uD83C\uDFCA\u200D\u2640\uFE0F","\uD83C\uDFCA\u200D\u2640"],"","",["woman-swimming"],9,8,15,0],
		"1f3ca-200d-2642-fe0f":[["\uD83C\uDFCA\u200D\u2642\uFE0F","\uD83C\uDFCA\u200D\u2642","\uD83C\uDFCA"],"","",["man-swimming","swimmer"],9,14,15,0],
		"1f3cb-fe0f-200d-2640-fe0f":[["\uD83C\uDFCB\uFE0F\u200D\u2640\uFE0F"],"","",["woman-lifting-weights"],9,26,7,0],
		"1f3cb-fe0f-200d-2642-fe0f":[["\uD83C\uDFCB\uFE0F\u200D\u2642\uFE0F","\uD83C\uDFCB\uFE0F","\uD83C\uDFCB"],"","",["man-lifting-weights","weight_lifter"],9,32,7,0],
		"1f3cc-fe0f-200d-2640-fe0f":[["\uD83C\uDFCC\uFE0F\u200D\u2640\uFE0F"],"","",["woman-golfing"],9,44,7,0],
		"1f3cc-fe0f-200d-2642-fe0f":[["\uD83C\uDFCC\uFE0F\u200D\u2642\uFE0F","\uD83C\uDFCC\uFE0F","\uD83C\uDFCC"],"","",["man-golfing","golfer"],9,50,7,0],
		"1f3cd-fe0f":[["\uD83C\uDFCD\uFE0F","\uD83C\uDFCD"],"","",["racing_motorcycle"],10,2,15,0],
		"1f3ce-fe0f":[["\uD83C\uDFCE\uFE0F","\uD83C\uDFCE"],"","",["racing_car"],10,3,15,0],
		"1f3cf":[["\uD83C\uDFCF"],"","",["cricket_bat_and_ball"],10,4,15,0],
		"1f3d0":[["\uD83C\uDFD0"],"","",["volleyball"],10,5,15,0],
		"1f3d1":[["\uD83C\uDFD1"],"","",["field_hockey_stick_and_ball"],10,6,15,0],
		"1f3d2":[["\uD83C\uDFD2"],"","",["ice_hockey_stick_and_puck"],10,7,15,0],
		"1f3d3":[["\uD83C\uDFD3"],"","",["table_tennis_paddle_and_ball"],10,8,15,0],
		"1f3d4-fe0f":[["\uD83C\uDFD4\uFE0F","\uD83C\uDFD4"],"","",["snow_capped_mountain"],10,9,15,0],
		"1f3d5-fe0f":[["\uD83C\uDFD5\uFE0F","\uD83C\uDFD5"],"","",["camping"],10,10,15,0],
		"1f3d6-fe0f":[["\uD83C\uDFD6\uFE0F","\uD83C\uDFD6"],"","",["beach_with_umbrella"],10,11,15,0],
		"1f3d7-fe0f":[["\uD83C\uDFD7\uFE0F","\uD83C\uDFD7"],"","",["building_construction"],10,12,15,0],
		"1f3d8-fe0f":[["\uD83C\uDFD8\uFE0F","\uD83C\uDFD8"],"","",["house_buildings"],10,13,15,0],
		"1f3d9-fe0f":[["\uD83C\uDFD9\uFE0F","\uD83C\uDFD9"],"","",["cityscape"],10,14,15,0],
		"1f3da-fe0f":[["\uD83C\uDFDA\uFE0F","\uD83C\uDFDA"],"","",["derelict_house_building"],10,15,15,0],
		"1f3db-fe0f":[["\uD83C\uDFDB\uFE0F","\uD83C\uDFDB"],"","",["classical_building"],10,16,15,0],
		"1f3dc-fe0f":[["\uD83C\uDFDC\uFE0F","\uD83C\uDFDC"],"","",["desert"],10,17,15,0],
		"1f3dd-fe0f":[["\uD83C\uDFDD\uFE0F","\uD83C\uDFDD"],"","",["desert_island"],10,18,15,0],
		"1f3de-fe0f":[["\uD83C\uDFDE\uFE0F","\uD83C\uDFDE"],"","",["national_park"],10,19,15,0],
		"1f3df-fe0f":[["\uD83C\uDFDF\uFE0F","\uD83C\uDFDF"],"","",["stadium"],10,20,15,0],
		"1f3e0":[["\uD83C\uDFE0"],"\uE036","\uDBB9\uDCB0",["house"],10,21,15,0],
		"1f3e1":[["\uD83C\uDFE1"],"","\uDBB9\uDCB1",["house_with_garden"],10,22,15,0],
		"1f3e2":[["\uD83C\uDFE2"],"\uE038","\uDBB9\uDCB2",["office"],10,23,15,0],
		"1f3e3":[["\uD83C\uDFE3"],"\uE153","\uDBB9\uDCB3",["post_office"],10,24,15,0],
		"1f3e4":[["\uD83C\uDFE4"],"","",["european_post_office"],10,25,15,0],
		"1f3e5":[["\uD83C\uDFE5"],"\uE155","\uDBB9\uDCB4",["hospital"],10,26,15,0],
		"1f3e6":[["\uD83C\uDFE6"],"\uE14D","\uDBB9\uDCB5",["bank"],10,27,15,0],
		"1f3e7":[["\uD83C\uDFE7"],"\uE154","\uDBB9\uDCB6",["atm"],10,28,15,0],
		"1f3e8":[["\uD83C\uDFE8"],"\uE158","\uDBB9\uDCB7",["hotel"],10,29,15,0],
		"1f3e9":[["\uD83C\uDFE9"],"\uE501","\uDBB9\uDCB8",["love_hotel"],10,30,15,0],
		"1f3ea":[["\uD83C\uDFEA"],"\uE156","\uDBB9\uDCB9",["convenience_store"],10,31,15,0],
		"1f3eb":[["\uD83C\uDFEB"],"\uE157","\uDBB9\uDCBA",["school"],10,32,15,0],
		"1f3ec":[["\uD83C\uDFEC"],"\uE504","\uDBB9\uDCBD",["department_store"],10,33,15,0],
		"1f3ed":[["\uD83C\uDFED"],"\uE508","\uDBB9\uDCC0",["factory"],10,34,15,0],
		"1f3ee":[["\uD83C\uDFEE"],"","\uDBB9\uDCC2",["izakaya_lantern","lantern"],10,35,15,0],
		"1f3ef":[["\uD83C\uDFEF"],"\uE505","\uDBB9\uDCBE",["japanese_castle"],10,36,15,0],
		"1f3f0":[["\uD83C\uDFF0"],"\uE506","\uDBB9\uDCBF",["european_castle"],10,37,15,0],
		"1f3f3-fe0f-200d-1f308":[["\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08","\uD83C\uDFF3\u200D\uD83C\uDF08"],"","",["rainbow-flag"],10,38,15,0],
		"1f3f3-fe0f-200d-26a7-fe0f":[["\uD83C\uDFF3\uFE0F\u200D\u26A7\uFE0F"],"","",["transgender_flag"],10,39,7,0],
		"1f3f3-fe0f":[["\uD83C\uDFF3\uFE0F","\uD83C\uDFF3"],"","",["waving_white_flag"],10,40,15,0],
		"1f3f4-200d-2620-fe0f":[["\uD83C\uDFF4\u200D\u2620\uFE0F","\uD83C\uDFF4\u200D\u2620"],"","",["pirate_flag"],10,41,15,0],
		"1f3f4-e0067-e0062-e0065-e006e-e0067-e007f":[["\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F"],"","",["flag-england"],10,42,15,0],
		"1f3f4-e0067-e0062-e0073-e0063-e0074-e007f":[["\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F"],"","",["flag-scotland"],10,43,15,0],
		"1f3f4-e0067-e0062-e0077-e006c-e0073-e007f":[["\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F"],"","",["flag-wales"],10,44,15,0],
		"1f3f4":[["\uD83C\uDFF4"],"","",["waving_black_flag"],10,45,15,0],
		"1f3f5-fe0f":[["\uD83C\uDFF5\uFE0F","\uD83C\uDFF5"],"","",["rosette"],10,46,15,0],
		"1f3f7-fe0f":[["\uD83C\uDFF7\uFE0F","\uD83C\uDFF7"],"","",["label"],10,47,15,0],
		"1f3f8":[["\uD83C\uDFF8"],"","",["badminton_racquet_and_shuttlecock"],10,48,15,0],
		"1f3f9":[["\uD83C\uDFF9"],"","",["bow_and_arrow"],10,49,15,0],
		"1f3fa":[["\uD83C\uDFFA"],"","",["amphora"],10,50,15,0],
		"1f3fb":[["\uD83C\uDFFB"],"","",["skin-tone-2"],10,51,15,0],
		"1f3fc":[["\uD83C\uDFFC"],"","",["skin-tone-3"],10,52,15,0],
		"1f3fd":[["\uD83C\uDFFD"],"","",["skin-tone-4"],10,53,15,0],
		"1f3fe":[["\uD83C\uDFFE"],"","",["skin-tone-5"],10,54,15,0],
		"1f3ff":[["\uD83C\uDFFF"],"","",["skin-tone-6"],10,55,15,0],
		"1f400":[["\uD83D\uDC00"],"","",["rat"],10,56,15,0],
		"1f401":[["\uD83D\uDC01"],"","",["mouse2"],10,57,15,0],
		"1f402":[["\uD83D\uDC02"],"","",["ox"],10,58,15,0],
		"1f403":[["\uD83D\uDC03"],"","",["water_buffalo"],10,59,15,0],
		"1f404":[["\uD83D\uDC04"],"","",["cow2"],11,0,15,0],
		"1f405":[["\uD83D\uDC05"],"","",["tiger2"],11,1,15,0],
		"1f406":[["\uD83D\uDC06"],"","",["leopard"],11,2,15,0],
		"1f407":[["\uD83D\uDC07"],"","",["rabbit2"],11,3,15,0],
		"1f408-200d-2b1b":[["\uD83D\uDC08\u200D\u2B1B"],"","",["black_cat"],11,4,15,0],
		"1f408":[["\uD83D\uDC08"],"","",["cat2"],11,5,15,0],
		"1f409":[["\uD83D\uDC09"],"","",["dragon"],11,6,15,0],
		"1f40a":[["\uD83D\uDC0A"],"","",["crocodile"],11,7,15,0],
		"1f40b":[["\uD83D\uDC0B"],"","",["whale2"],11,8,15,0],
		"1f40c":[["\uD83D\uDC0C"],"","\uDBB8\uDDB9",["snail"],11,9,15,0],
		"1f40d":[["\uD83D\uDC0D"],"\uE52D","\uDBB8\uDDD3",["snake"],11,10,15,0],
		"1f40e":[["\uD83D\uDC0E"],"\uE134","\uDBB9\uDFDC",["racehorse"],11,11,15,0],
		"1f40f":[["\uD83D\uDC0F"],"","",["ram"],11,12,15,0],
		"1f410":[["\uD83D\uDC10"],"","",["goat"],11,13,15,0],
		"1f411":[["\uD83D\uDC11"],"\uE529","\uDBB8\uDDCF",["sheep"],11,14,15,0],
		"1f412":[["\uD83D\uDC12"],"\uE528","\uDBB8\uDDCE",["monkey"],11,15,15,0],
		"1f413":[["\uD83D\uDC13"],"","",["rooster"],11,16,15,0],
		"1f414":[["\uD83D\uDC14"],"\uE52E","\uDBB8\uDDD4",["chicken"],11,17,15,0],
		"1f415-200d-1f9ba":[["\uD83D\uDC15\u200D\uD83E\uDDBA"],"","",["service_dog"],11,18,15,0],
		"1f415":[["\uD83D\uDC15"],"","",["dog2"],11,19,15,0],
		"1f416":[["\uD83D\uDC16"],"","",["pig2"],11,20,15,0],
		"1f417":[["\uD83D\uDC17"],"\uE52F","\uDBB8\uDDD5",["boar"],11,21,15,0],
		"1f418":[["\uD83D\uDC18"],"\uE526","\uDBB8\uDDCC",["elephant"],11,22,15,0],
		"1f419":[["\uD83D\uDC19"],"\uE10A","\uDBB8\uDDC5",["octopus"],11,23,15,0],
		"1f41a":[["\uD83D\uDC1A"],"\uE441","\uDBB8\uDDC6",["shell"],11,24,15,0],
		"1f41b":[["\uD83D\uDC1B"],"\uE525","\uDBB8\uDDCB",["bug"],11,25,15,0],
		"1f41c":[["\uD83D\uDC1C"],"","\uDBB8\uDDDA",["ant"],11,26,15,0],
		"1f41d":[["\uD83D\uDC1D"],"","\uDBB8\uDDE1",["bee","honeybee"],11,27,15,0],
		"1f41e":[["\uD83D\uDC1E"],"","\uDBB8\uDDE2",["ladybug","lady_beetle"],11,28,15,0],
		"1f41f":[["\uD83D\uDC1F"],"\uE019","\uDBB8\uDDBD",["fish"],11,29,15,0],
		"1f420":[["\uD83D\uDC20"],"\uE522","\uDBB8\uDDC9",["tropical_fish"],11,30,15,0],
		"1f421":[["\uD83D\uDC21"],"","\uDBB8\uDDD9",["blowfish"],11,31,15,0],
		"1f422":[["\uD83D\uDC22"],"","\uDBB8\uDDDC",["turtle"],11,32,15,0],
		"1f423":[["\uD83D\uDC23"],"","\uDBB8\uDDDD",["hatching_chick"],11,33,15,0],
		"1f424":[["\uD83D\uDC24"],"\uE523","\uDBB8\uDDBA",["baby_chick"],11,34,15,0],
		"1f425":[["\uD83D\uDC25"],"","\uDBB8\uDDBB",["hatched_chick"],11,35,15,0],
		"1f426":[["\uD83D\uDC26"],"\uE521","\uDBB8\uDDC8",["bird"],11,36,15,0],
		"1f427":[["\uD83D\uDC27"],"\uE055","\uDBB8\uDDBC",["penguin"],11,37,15,0],
		"1f428":[["\uD83D\uDC28"],"\uE527","\uDBB8\uDDCD",["koala"],11,38,15,0],
		"1f429":[["\uD83D\uDC29"],"","\uDBB8\uDDD8",["poodle"],11,39,15,0],
		"1f42a":[["\uD83D\uDC2A"],"","",["dromedary_camel"],11,40,15,0],
		"1f42b":[["\uD83D\uDC2B"],"\uE530","\uDBB8\uDDD6",["camel"],11,41,15,0],
		"1f42c":[["\uD83D\uDC2C"],"\uE520","\uDBB8\uDDC7",["dolphin","flipper"],11,42,15,0],
		"1f42d":[["\uD83D\uDC2D"],"\uE053","\uDBB8\uDDC2",["mouse"],11,43,15,0],
		"1f42e":[["\uD83D\uDC2E"],"\uE52B","\uDBB8\uDDD1",["cow"],11,44,15,0],
		"1f42f":[["\uD83D\uDC2F"],"\uE050","\uDBB8\uDDC0",["tiger"],11,45,15,0],
		"1f430":[["\uD83D\uDC30"],"\uE52C","\uDBB8\uDDD2",["rabbit"],11,46,15,0],
		"1f431":[["\uD83D\uDC31"],"\uE04F","\uDBB8\uDDB8",["cat"],11,47,15,0],
		"1f432":[["\uD83D\uDC32"],"","\uDBB8\uDDDE",["dragon_face"],11,48,15,0],
		"1f433":[["\uD83D\uDC33"],"\uE054","\uDBB8\uDDC3",["whale"],11,49,15,0],
		"1f434":[["\uD83D\uDC34"],"\uE01A","\uDBB8\uDDBE",["horse"],11,50,15,0],
		"1f435":[["\uD83D\uDC35"],"\uE109","\uDBB8\uDDC4",["monkey_face"],11,51,15,0],
		"1f436":[["\uD83D\uDC36"],"\uE052","\uDBB8\uDDB7",["dog"],11,52,15,0],
		"1f437":[["\uD83D\uDC37"],"\uE10B","\uDBB8\uDDBF",["pig"],11,53,15,0],
		"1f438":[["\uD83D\uDC38"],"\uE531","\uDBB8\uDDD7",["frog"],11,54,15,0],
		"1f439":[["\uD83D\uDC39"],"\uE524","\uDBB8\uDDCA",["hamster"],11,55,15,0],
		"1f43a":[["\uD83D\uDC3A"],"\uE52A","\uDBB8\uDDD0",["wolf"],11,56,15,0],
		"1f43b-200d-2744-fe0f":[["\uD83D\uDC3B\u200D\u2744\uFE0F","\uD83D\uDC3B\u200D\u2744"],"","",["polar_bear"],11,57,15,0],
		"1f43b":[["\uD83D\uDC3B"],"\uE051","\uDBB8\uDDC1",["bear"],11,58,15,0],
		"1f43c":[["\uD83D\uDC3C"],"","\uDBB8\uDDDF",["panda_face"],11,59,15,0],
		"1f43d":[["\uD83D\uDC3D"],"","\uDBB8\uDDE0",["pig_nose"],12,0,15,0],
		"1f43e":[["\uD83D\uDC3E"],"","\uDBB8\uDDDB",["feet","paw_prints"],12,1,15,0],
		"1f43f-fe0f":[["\uD83D\uDC3F\uFE0F","\uD83D\uDC3F"],"","",["chipmunk"],12,2,15,0],
		"1f440":[["\uD83D\uDC40"],"\uE419","\uDBB8\uDD90",["eyes"],12,3,15,0],
		"1f441-fe0f-200d-1f5e8-fe0f":[["\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8\uFE0F"],"","",["eye-in-speech-bubble"],12,4,7,0],
		"1f441-fe0f":[["\uD83D\uDC41\uFE0F","\uD83D\uDC41"],"","",["eye"],12,5,15,0],
		"1f442":[["\uD83D\uDC42"],"\uE41B","\uDBB8\uDD91",["ear"],12,6,15,0],
		"1f443":[["\uD83D\uDC43"],"\uE41A","\uDBB8\uDD92",["nose"],12,12,15,0],
		"1f444":[["\uD83D\uDC44"],"\uE41C","\uDBB8\uDD93",["lips"],12,18,15,0],
		"1f445":[["\uD83D\uDC45"],"","\uDBB8\uDD94",["tongue"],12,19,15,0],
		"1f446":[["\uD83D\uDC46"],"\uE22E","\uDBBA\uDF99",["point_up_2"],12,20,15,0],
		"1f447":[["\uD83D\uDC47"],"\uE22F","\uDBBA\uDF9A",["point_down"],12,26,15,0],
		"1f448":[["\uD83D\uDC48"],"\uE230","\uDBBA\uDF9B",["point_left"],12,32,15,0],
		"1f449":[["\uD83D\uDC49"],"\uE231","\uDBBA\uDF9C",["point_right"],12,38,15,0],
		"1f44a":[["\uD83D\uDC4A"],"\uE00D","\uDBBA\uDF96",["facepunch","punch"],12,44,15,0],
		"1f44b":[["\uD83D\uDC4B"],"\uE41E","\uDBBA\uDF9D",["wave"],12,50,15,0],
		"1f44c":[["\uD83D\uDC4C"],"\uE420","\uDBBA\uDF9F",["ok_hand"],12,56,15,0],
		"1f44d":[["\uD83D\uDC4D"],"\uE00E","\uDBBA\uDF97",["+1","thumbsup"],13,2,15,0],
		"1f44e":[["\uD83D\uDC4E"],"\uE421","\uDBBA\uDFA0",["-1","thumbsdown"],13,8,15,0],
		"1f44f":[["\uD83D\uDC4F"],"\uE41F","\uDBBA\uDF9E",["clap"],13,14,15,0],
		"1f450":[["\uD83D\uDC50"],"\uE422","\uDBBA\uDFA1",["open_hands"],13,20,15,0],
		"1f451":[["\uD83D\uDC51"],"\uE10E","\uDBB9\uDCD1",["crown"],13,26,15,0],
		"1f452":[["\uD83D\uDC52"],"\uE318","\uDBB9\uDCD4",["womans_hat"],13,27,15,0],
		"1f453":[["\uD83D\uDC53"],"","\uDBB9\uDCCE",["eyeglasses"],13,28,15,0],
		"1f454":[["\uD83D\uDC54"],"\uE302","\uDBB9\uDCD3",["necktie"],13,29,15,0],
		"1f455":[["\uD83D\uDC55"],"\uE006","\uDBB9\uDCCF",["shirt","tshirt"],13,30,15,0],
		"1f456":[["\uD83D\uDC56"],"","\uDBB9\uDCD0",["jeans"],13,31,15,0],
		"1f457":[["\uD83D\uDC57"],"\uE319","\uDBB9\uDCD5",["dress"],13,32,15,0],
		"1f458":[["\uD83D\uDC58"],"\uE321","\uDBB9\uDCD9",["kimono"],13,33,15,0],
		"1f459":[["\uD83D\uDC59"],"\uE322","\uDBB9\uDCDA",["bikini"],13,34,15,0],
		"1f45a":[["\uD83D\uDC5A"],"","\uDBB9\uDCDB",["womans_clothes"],13,35,15,0],
		"1f45b":[["\uD83D\uDC5B"],"","\uDBB9\uDCDC",["purse"],13,36,15,0],
		"1f45c":[["\uD83D\uDC5C"],"\uE323","\uDBB9\uDCF0",["handbag"],13,37,15,0],
		"1f45d":[["\uD83D\uDC5D"],"","\uDBB9\uDCF1",["pouch"],13,38,15,0],
		"1f45e":[["\uD83D\uDC5E"],"","\uDBB9\uDCCC",["mans_shoe","shoe"],13,39,15,0],
		"1f45f":[["\uD83D\uDC5F"],"\uE007","\uDBB9\uDCCD",["athletic_shoe"],13,40,15,0],
		"1f460":[["\uD83D\uDC60"],"\uE13E","\uDBB9\uDCD6",["high_heel"],13,41,15,0],
		"1f461":[["\uD83D\uDC61"],"\uE31A","\uDBB9\uDCD7",["sandal"],13,42,15,0],
		"1f462":[["\uD83D\uDC62"],"\uE31B","\uDBB9\uDCD8",["boot"],13,43,15,0],
		"1f463":[["\uD83D\uDC63"],"\uE536","\uDBB9\uDD53",["footprints"],13,44,15,0],
		"1f464":[["\uD83D\uDC64"],"","\uDBB8\uDD9A",["bust_in_silhouette"],13,45,15,0],
		"1f465":[["\uD83D\uDC65"],"","",["busts_in_silhouette"],13,46,15,0],
		"1f466":[["\uD83D\uDC66"],"\uE001","\uDBB8\uDD9B",["boy"],13,47,15,0],
		"1f467":[["\uD83D\uDC67"],"\uE002","\uDBB8\uDD9C",["girl"],13,53,15,0],
		"1f468-200d-1f33e":[["\uD83D\uDC68\u200D\uD83C\uDF3E"],"","",["male-farmer"],13,59,15,0],
		"1f468-200d-1f373":[["\uD83D\uDC68\u200D\uD83C\uDF73"],"","",["male-cook"],14,5,15,0],
		"1f468-200d-1f37c":[["\uD83D\uDC68\u200D\uD83C\uDF7C"],"","",["man_feeding_baby"],14,11,15,0],
		"1f468-200d-1f393":[["\uD83D\uDC68\u200D\uD83C\uDF93"],"","",["male-student"],14,17,15,0],
		"1f468-200d-1f3a4":[["\uD83D\uDC68\u200D\uD83C\uDFA4"],"","",["male-singer"],14,23,15,0],
		"1f468-200d-1f3a8":[["\uD83D\uDC68\u200D\uD83C\uDFA8"],"","",["male-artist"],14,29,15,0],
		"1f468-200d-1f3eb":[["\uD83D\uDC68\u200D\uD83C\uDFEB"],"","",["male-teacher"],14,35,15,0],
		"1f468-200d-1f3ed":[["\uD83D\uDC68\u200D\uD83C\uDFED"],"","",["male-factory-worker"],14,41,15,0],
		"1f468-200d-1f466-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC66\u200D\uD83D\uDC66"],"","",["man-boy-boy"],14,47,15,0],
		"1f468-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC66"],"","",["man-boy"],14,48,15,0],
		"1f468-200d-1f467-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC67\u200D\uD83D\uDC66"],"","",["man-girl-boy"],14,49,15,0],
		"1f468-200d-1f467-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC67\u200D\uD83D\uDC67"],"","",["man-girl-girl"],14,50,15,0],
		"1f468-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC67"],"","",["man-girl"],14,51,15,0],
		"1f468-200d-1f468-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC68\u200D\uD83D\uDC66"],"","",["man-man-boy"],14,52,15,0],
		"1f468-200d-1f468-200d-1f466-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC68\u200D\uD83D\uDC66\u200D\uD83D\uDC66"],"","",["man-man-boy-boy"],14,53,15,0],
		"1f468-200d-1f468-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC68\u200D\uD83D\uDC67"],"","",["man-man-girl"],14,54,15,0],
		"1f468-200d-1f468-200d-1f467-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC68\u200D\uD83D\uDC67\u200D\uD83D\uDC66"],"","",["man-man-girl-boy"],14,55,15,0],
		"1f468-200d-1f468-200d-1f467-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC68\u200D\uD83D\uDC67\u200D\uD83D\uDC67"],"","",["man-man-girl-girl"],14,56,15,0],
		"1f468-200d-1f469-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC66","\uD83D\uDC6A"],"","",["man-woman-boy","family"],14,57,15,0],
		"1f468-200d-1f469-200d-1f466-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66"],"","",["man-woman-boy-boy"],14,58,15,0],
		"1f468-200d-1f469-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67"],"","",["man-woman-girl"],14,59,15,0],
		"1f468-200d-1f469-200d-1f467-200d-1f466":[["\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"],"","",["man-woman-girl-boy"],15,0,15,0],
		"1f468-200d-1f469-200d-1f467-200d-1f467":[["\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC67"],"","",["man-woman-girl-girl"],15,1,15,0],
		"1f468-200d-1f4bb":[["\uD83D\uDC68\u200D\uD83D\uDCBB"],"","",["male-technologist"],15,2,15,0],
		"1f468-200d-1f4bc":[["\uD83D\uDC68\u200D\uD83D\uDCBC"],"","",["male-office-worker"],15,8,15,0],
		"1f468-200d-1f527":[["\uD83D\uDC68\u200D\uD83D\uDD27"],"","",["male-mechanic"],15,14,15,0],
		"1f468-200d-1f52c":[["\uD83D\uDC68\u200D\uD83D\uDD2C"],"","",["male-scientist"],15,20,15,0],
		"1f468-200d-1f680":[["\uD83D\uDC68\u200D\uD83D\uDE80"],"","",["male-astronaut"],15,26,15,0],
		"1f468-200d-1f692":[["\uD83D\uDC68\u200D\uD83D\uDE92"],"","",["male-firefighter"],15,32,15,0],
		"1f468-200d-1f9af":[["\uD83D\uDC68\u200D\uD83E\uDDAF"],"","",["man_with_probing_cane"],15,38,15,0],
		"1f468-200d-1f9b0":[["\uD83D\uDC68\u200D\uD83E\uDDB0"],"","",["red_haired_man"],15,44,15,0],
		"1f468-200d-1f9b1":[["\uD83D\uDC68\u200D\uD83E\uDDB1"],"","",["curly_haired_man"],15,50,15,0],
		"1f468-200d-1f9b2":[["\uD83D\uDC68\u200D\uD83E\uDDB2"],"","",["bald_man"],15,56,15,0],
		"1f468-200d-1f9b3":[["\uD83D\uDC68\u200D\uD83E\uDDB3"],"","",["white_haired_man"],16,2,15,0],
		"1f468-200d-1f9bc":[["\uD83D\uDC68\u200D\uD83E\uDDBC"],"","",["man_in_motorized_wheelchair"],16,8,15,0],
		"1f468-200d-1f9bd":[["\uD83D\uDC68\u200D\uD83E\uDDBD"],"","",["man_in_manual_wheelchair"],16,14,15,0],
		"1f468-200d-2695-fe0f":[["\uD83D\uDC68\u200D\u2695\uFE0F","\uD83D\uDC68\u200D\u2695"],"","",["male-doctor"],16,20,15,0],
		"1f468-200d-2696-fe0f":[["\uD83D\uDC68\u200D\u2696\uFE0F","\uD83D\uDC68\u200D\u2696"],"","",["male-judge"],16,26,15,0],
		"1f468-200d-2708-fe0f":[["\uD83D\uDC68\u200D\u2708\uFE0F","\uD83D\uDC68\u200D\u2708"],"","",["male-pilot"],16,32,15,0],
		"1f468-200d-2764-fe0f-200d-1f468":[["\uD83D\uDC68\u200D\u2764\uFE0F\u200D\uD83D\uDC68","\uD83D\uDC68\u200D\u2764\u200D\uD83D\uDC68"],"","",["man-heart-man"],16,38,15,0],
		"1f468-200d-2764-fe0f-200d-1f48b-200d-1f468":[["\uD83D\uDC68\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68","\uD83D\uDC68\u200D\u2764\u200D\uD83D\uDC8B\u200D\uD83D\uDC68"],"","",["man-kiss-man"],17,4,15,0],
		"1f468":[["\uD83D\uDC68"],"\uE004","\uDBB8\uDD9D",["man"],17,30,15,0],
		"1f469-200d-1f33e":[["\uD83D\uDC69\u200D\uD83C\uDF3E"],"","",["female-farmer"],17,36,15,0],
		"1f469-200d-1f373":[["\uD83D\uDC69\u200D\uD83C\uDF73"],"","",["female-cook"],17,42,15,0],
		"1f469-200d-1f37c":[["\uD83D\uDC69\u200D\uD83C\uDF7C"],"","",["woman_feeding_baby"],17,48,15,0],
		"1f469-200d-1f393":[["\uD83D\uDC69\u200D\uD83C\uDF93"],"","",["female-student"],17,54,15,0],
		"1f469-200d-1f3a4":[["\uD83D\uDC69\u200D\uD83C\uDFA4"],"","",["female-singer"],18,0,15,0],
		"1f469-200d-1f3a8":[["\uD83D\uDC69\u200D\uD83C\uDFA8"],"","",["female-artist"],18,6,15,0],
		"1f469-200d-1f3eb":[["\uD83D\uDC69\u200D\uD83C\uDFEB"],"","",["female-teacher"],18,12,15,0],
		"1f469-200d-1f3ed":[["\uD83D\uDC69\u200D\uD83C\uDFED"],"","",["female-factory-worker"],18,18,15,0],
		"1f469-200d-1f466-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66"],"","",["woman-boy-boy"],18,24,15,0],
		"1f469-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC66"],"","",["woman-boy"],18,25,15,0],
		"1f469-200d-1f467-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"],"","",["woman-girl-boy"],18,26,15,0],
		"1f469-200d-1f467-200d-1f467":[["\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC67"],"","",["woman-girl-girl"],18,27,15,0],
		"1f469-200d-1f467":[["\uD83D\uDC69\u200D\uD83D\uDC67"],"","",["woman-girl"],18,28,15,0],
		"1f469-200d-1f469-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC66"],"","",["woman-woman-boy"],18,29,15,0],
		"1f469-200d-1f469-200d-1f466-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66"],"","",["woman-woman-boy-boy"],18,30,15,0],
		"1f469-200d-1f469-200d-1f467":[["\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67"],"","",["woman-woman-girl"],18,31,15,0],
		"1f469-200d-1f469-200d-1f467-200d-1f466":[["\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"],"","",["woman-woman-girl-boy"],18,32,15,0],
		"1f469-200d-1f469-200d-1f467-200d-1f467":[["\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC67"],"","",["woman-woman-girl-girl"],18,33,15,0],
		"1f469-200d-1f4bb":[["\uD83D\uDC69\u200D\uD83D\uDCBB"],"","",["female-technologist"],18,34,15,0],
		"1f469-200d-1f4bc":[["\uD83D\uDC69\u200D\uD83D\uDCBC"],"","",["female-office-worker"],18,40,15,0],
		"1f469-200d-1f527":[["\uD83D\uDC69\u200D\uD83D\uDD27"],"","",["female-mechanic"],18,46,15,0],
		"1f469-200d-1f52c":[["\uD83D\uDC69\u200D\uD83D\uDD2C"],"","",["female-scientist"],18,52,15,0],
		"1f469-200d-1f680":[["\uD83D\uDC69\u200D\uD83D\uDE80"],"","",["female-astronaut"],18,58,15,0],
		"1f469-200d-1f692":[["\uD83D\uDC69\u200D\uD83D\uDE92"],"","",["female-firefighter"],19,4,15,0],
		"1f469-200d-1f9af":[["\uD83D\uDC69\u200D\uD83E\uDDAF"],"","",["woman_with_probing_cane"],19,10,15,0],
		"1f469-200d-1f9b0":[["\uD83D\uDC69\u200D\uD83E\uDDB0"],"","",["red_haired_woman"],19,16,15,0],
		"1f469-200d-1f9b1":[["\uD83D\uDC69\u200D\uD83E\uDDB1"],"","",["curly_haired_woman"],19,22,15,0],
		"1f469-200d-1f9b2":[["\uD83D\uDC69\u200D\uD83E\uDDB2"],"","",["bald_woman"],19,28,15,0],
		"1f469-200d-1f9b3":[["\uD83D\uDC69\u200D\uD83E\uDDB3"],"","",["white_haired_woman"],19,34,15,0],
		"1f469-200d-1f9bc":[["\uD83D\uDC69\u200D\uD83E\uDDBC"],"","",["woman_in_motorized_wheelchair"],19,40,15,0],
		"1f469-200d-1f9bd":[["\uD83D\uDC69\u200D\uD83E\uDDBD"],"","",["woman_in_manual_wheelchair"],19,46,15,0],
		"1f469-200d-2695-fe0f":[["\uD83D\uDC69\u200D\u2695\uFE0F","\uD83D\uDC69\u200D\u2695"],"","",["female-doctor"],19,52,15,0],
		"1f469-200d-2696-fe0f":[["\uD83D\uDC69\u200D\u2696\uFE0F","\uD83D\uDC69\u200D\u2696"],"","",["female-judge"],19,58,15,0],
		"1f469-200d-2708-fe0f":[["\uD83D\uDC69\u200D\u2708\uFE0F","\uD83D\uDC69\u200D\u2708"],"","",["female-pilot"],20,4,15,0],
		"1f469-200d-2764-fe0f-200d-1f468":[["\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC68","\uD83D\uDC69\u200D\u2764\u200D\uD83D\uDC68"],"","",["woman-heart-man"],20,10,15,0],
		"1f469-200d-2764-fe0f-200d-1f469":[["\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC69","\uD83D\uDC69\u200D\u2764\u200D\uD83D\uDC69"],"","",["woman-heart-woman"],20,36,15,0],
		"1f469-200d-2764-fe0f-200d-1f48b-200d-1f468":[["\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68","\uD83D\uDC69\u200D\u2764\u200D\uD83D\uDC8B\u200D\uD83D\uDC68"],"","",["woman-kiss-man"],21,2,15,0],
		"1f469-200d-2764-fe0f-200d-1f48b-200d-1f469":[["\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69","\uD83D\uDC69\u200D\u2764\u200D\uD83D\uDC8B\u200D\uD83D\uDC69"],"","",["woman-kiss-woman"],21,28,15,0],
		"1f469":[["\uD83D\uDC69"],"\uE005","\uDBB8\uDD9E",["woman"],21,54,15,0],
		"1f46b":[["\uD83D\uDC6B"],"\uE428","\uDBB8\uDDA0",["man_and_woman_holding_hands","woman_and_man_holding_hands","couple"],22,1,15,0],
		"1f46c":[["\uD83D\uDC6C"],"","",["two_men_holding_hands","men_holding_hands"],22,27,15,0],
		"1f46d":[["\uD83D\uDC6D"],"","",["two_women_holding_hands","women_holding_hands"],22,53,15,0],
		"1f46e-200d-2640-fe0f":[["\uD83D\uDC6E\u200D\u2640\uFE0F","\uD83D\uDC6E\u200D\u2640"],"","",["female-police-officer"],23,19,15,0],
		"1f46e-200d-2642-fe0f":[["\uD83D\uDC6E\u200D\u2642\uFE0F","\uD83D\uDC6E\u200D\u2642","\uD83D\uDC6E"],"","",["male-police-officer","cop"],23,25,15,0],
		"1f46f-200d-2640-fe0f":[["\uD83D\uDC6F\u200D\u2640\uFE0F","\uD83D\uDC6F\u200D\u2640","\uD83D\uDC6F"],"","",["women-with-bunny-ears-partying","woman-with-bunny-ears-partying","dancers"],23,37,15,0],
		"1f46f-200d-2642-fe0f":[["\uD83D\uDC6F\u200D\u2642\uFE0F","\uD83D\uDC6F\u200D\u2642"],"","",["men-with-bunny-ears-partying","man-with-bunny-ears-partying"],23,38,15,0],
		"1f470-200d-2640-fe0f":[["\uD83D\uDC70\u200D\u2640\uFE0F","\uD83D\uDC70\u200D\u2640"],"","",["woman_with_veil"],23,40,15,0],
		"1f470-200d-2642-fe0f":[["\uD83D\uDC70\u200D\u2642\uFE0F","\uD83D\uDC70\u200D\u2642"],"","",["man_with_veil"],23,46,15,0],
		"1f470":[["\uD83D\uDC70"],"","\uDBB8\uDDA3",["bride_with_veil"],23,52,15,0],
		"1f471-200d-2640-fe0f":[["\uD83D\uDC71\u200D\u2640\uFE0F","\uD83D\uDC71\u200D\u2640"],"","",["blond-haired-woman"],23,58,15,0],
		"1f471-200d-2642-fe0f":[["\uD83D\uDC71\u200D\u2642\uFE0F","\uD83D\uDC71\u200D\u2642","\uD83D\uDC71"],"","",["blond-haired-man","person_with_blond_hair"],24,4,15,0],
		"1f472":[["\uD83D\uDC72"],"\uE516","\uDBB8\uDDA5",["man_with_gua_pi_mao"],24,16,15,0],
		"1f473-200d-2640-fe0f":[["\uD83D\uDC73\u200D\u2640\uFE0F","\uD83D\uDC73\u200D\u2640"],"","",["woman-wearing-turban"],24,22,15,0],
		"1f473-200d-2642-fe0f":[["\uD83D\uDC73\u200D\u2642\uFE0F","\uD83D\uDC73\u200D\u2642","\uD83D\uDC73"],"","",["man-wearing-turban","man_with_turban"],24,28,15,0],
		"1f474":[["\uD83D\uDC74"],"\uE518","\uDBB8\uDDA7",["older_man"],24,40,15,0],
		"1f475":[["\uD83D\uDC75"],"\uE519","\uDBB8\uDDA8",["older_woman"],24,46,15,0],
		"1f476":[["\uD83D\uDC76"],"\uE51A","\uDBB8\uDDA9",["baby"],24,52,15,0],
		"1f477-200d-2640-fe0f":[["\uD83D\uDC77\u200D\u2640\uFE0F","\uD83D\uDC77\u200D\u2640"],"","",["female-construction-worker"],24,58,15,0],
		"1f477-200d-2642-fe0f":[["\uD83D\uDC77\u200D\u2642\uFE0F","\uD83D\uDC77\u200D\u2642","\uD83D\uDC77"],"","",["male-construction-worker","construction_worker"],25,4,15,0],
		"1f478":[["\uD83D\uDC78"],"\uE51C","\uDBB8\uDDAB",["princess"],25,16,15,0],
		"1f479":[["\uD83D\uDC79"],"","\uDBB8\uDDAC",["japanese_ogre"],25,22,15,0],
		"1f47a":[["\uD83D\uDC7A"],"","\uDBB8\uDDAD",["japanese_goblin"],25,23,15,0],
		"1f47b":[["\uD83D\uDC7B"],"\uE11B","\uDBB8\uDDAE",["ghost"],25,24,15,0],
		"1f47c":[["\uD83D\uDC7C"],"\uE04E","\uDBB8\uDDAF",["angel"],25,25,15,0],
		"1f47d":[["\uD83D\uDC7D"],"\uE10C","\uDBB8\uDDB0",["alien"],25,31,15,0],
		"1f47e":[["\uD83D\uDC7E"],"\uE12B","\uDBB8\uDDB1",["space_invader"],25,32,15,0],
		"1f47f":[["\uD83D\uDC7F"],"\uE11A","\uDBB8\uDDB2",["imp"],25,33,15,0],
		"1f480":[["\uD83D\uDC80"],"\uE11C","\uDBB8\uDDB3",["skull"],25,34,15,0],
		"1f481-200d-2640-fe0f":[["\uD83D\uDC81\u200D\u2640\uFE0F","\uD83D\uDC81\u200D\u2640","\uD83D\uDC81"],"","",["woman-tipping-hand","information_desk_person"],25,35,15,0],
		"1f481-200d-2642-fe0f":[["\uD83D\uDC81\u200D\u2642\uFE0F","\uD83D\uDC81\u200D\u2642"],"","",["man-tipping-hand"],25,41,15,0],
		"1f482-200d-2640-fe0f":[["\uD83D\uDC82\u200D\u2640\uFE0F","\uD83D\uDC82\u200D\u2640"],"","",["female-guard"],25,53,15,0],
		"1f482-200d-2642-fe0f":[["\uD83D\uDC82\u200D\u2642\uFE0F","\uD83D\uDC82\u200D\u2642","\uD83D\uDC82"],"","",["male-guard","guardsman"],25,59,15,0],
		"1f483":[["\uD83D\uDC83"],"\uE51F","\uDBB8\uDDB6",["dancer"],26,11,15,0],
		"1f484":[["\uD83D\uDC84"],"\uE31C","\uDBB8\uDD95",["lipstick"],26,17,15,0],
		"1f485":[["\uD83D\uDC85"],"\uE31D","\uDBB8\uDD96",["nail_care"],26,18,15,0],
		"1f486-200d-2640-fe0f":[["\uD83D\uDC86\u200D\u2640\uFE0F","\uD83D\uDC86\u200D\u2640","\uD83D\uDC86"],"","",["woman-getting-massage","massage"],26,24,15,0],
		"1f486-200d-2642-fe0f":[["\uD83D\uDC86\u200D\u2642\uFE0F","\uD83D\uDC86\u200D\u2642"],"","",["man-getting-massage"],26,30,15,0],
		"1f487-200d-2640-fe0f":[["\uD83D\uDC87\u200D\u2640\uFE0F","\uD83D\uDC87\u200D\u2640","\uD83D\uDC87"],"","",["woman-getting-haircut","haircut"],26,42,15,0],
		"1f487-200d-2642-fe0f":[["\uD83D\uDC87\u200D\u2642\uFE0F","\uD83D\uDC87\u200D\u2642"],"","",["man-getting-haircut"],26,48,15,0],
		"1f488":[["\uD83D\uDC88"],"\uE320","\uDBB8\uDD99",["barber"],27,0,15,0],
		"1f489":[["\uD83D\uDC89"],"\uE13B","\uDBB9\uDD09",["syringe"],27,1,15,0],
		"1f48a":[["\uD83D\uDC8A"],"\uE30F","\uDBB9\uDD0A",["pill"],27,2,15,0],
		"1f48b":[["\uD83D\uDC8B"],"\uE003","\uDBBA\uDC23",["kiss"],27,3,15,0],
		"1f48c":[["\uD83D\uDC8C"],"","\uDBBA\uDC24",["love_letter"],27,4,15,0],
		"1f48d":[["\uD83D\uDC8D"],"\uE034","\uDBBA\uDC25",["ring"],27,5,15,0],
		"1f48e":[["\uD83D\uDC8E"],"\uE035","\uDBBA\uDC26",["gem"],27,6,15,0],
		"1f48f":[["\uD83D\uDC8F"],"\uE111","\uDBBA\uDC27",["couplekiss"],27,7,15,0],
		"1f490":[["\uD83D\uDC90"],"\uE306","\uDBBA\uDC28",["bouquet"],27,33,15,0],
		"1f491":[["\uD83D\uDC91"],"\uE425","\uDBBA\uDC29",["couple_with_heart"],27,34,15,0],
		"1f492":[["\uD83D\uDC92"],"\uE43D","\uDBBA\uDC2A",["wedding"],28,0,15,0],
		"1f493":[["\uD83D\uDC93"],"\uE327","\uDBBA\uDF0D",["heartbeat"],28,1,15,0],
		"1f494":[["\uD83D\uDC94"],"\uE023","\uDBBA\uDF0E",["broken_heart"],28,2,15,0,"<\/3"],
		"1f495":[["\uD83D\uDC95"],"","\uDBBA\uDF0F",["two_hearts"],28,3,15,0],
		"1f496":[["\uD83D\uDC96"],"","\uDBBA\uDF10",["sparkling_heart"],28,4,15,0],
		"1f497":[["\uD83D\uDC97"],"\uE328","\uDBBA\uDF11",["heartpulse"],28,5,15,0],
		"1f498":[["\uD83D\uDC98"],"\uE329","\uDBBA\uDF12",["cupid"],28,6,15,0],
		"1f499":[["\uD83D\uDC99"],"\uE32A","\uDBBA\uDF13",["blue_heart"],28,7,15,0,"<3"],
		"1f49a":[["\uD83D\uDC9A"],"\uE32B","\uDBBA\uDF14",["green_heart"],28,8,15,0,"<3"],
		"1f49b":[["\uD83D\uDC9B"],"\uE32C","\uDBBA\uDF15",["yellow_heart"],28,9,15,0,"<3"],
		"1f49c":[["\uD83D\uDC9C"],"\uE32D","\uDBBA\uDF16",["purple_heart"],28,10,15,0,"<3"],
		"1f49d":[["\uD83D\uDC9D"],"\uE437","\uDBBA\uDF17",["gift_heart"],28,11,15,0],
		"1f49e":[["\uD83D\uDC9E"],"","\uDBBA\uDF18",["revolving_hearts"],28,12,15,0],
		"1f49f":[["\uD83D\uDC9F"],"\uE204","\uDBBA\uDF19",["heart_decoration"],28,13,15,0],
		"1f4a0":[["\uD83D\uDCA0"],"","\uDBBA\uDF55",["diamond_shape_with_a_dot_inside"],28,14,15,0],
		"1f4a1":[["\uD83D\uDCA1"],"\uE10F","\uDBBA\uDF56",["bulb"],28,15,15,0],
		"1f4a2":[["\uD83D\uDCA2"],"\uE334","\uDBBA\uDF57",["anger"],28,16,15,0],
		"1f4a3":[["\uD83D\uDCA3"],"\uE311","\uDBBA\uDF58",["bomb"],28,17,15,0],
		"1f4a4":[["\uD83D\uDCA4"],"\uE13C","\uDBBA\uDF59",["zzz"],28,18,15,0],
		"1f4a5":[["\uD83D\uDCA5"],"","\uDBBA\uDF5A",["boom","collision"],28,19,15,0],
		"1f4a6":[["\uD83D\uDCA6"],"\uE331","\uDBBA\uDF5B",["sweat_drops"],28,20,15,0],
		"1f4a7":[["\uD83D\uDCA7"],"","\uDBBA\uDF5C",["droplet"],28,21,15,0],
		"1f4a8":[["\uD83D\uDCA8"],"\uE330","\uDBBA\uDF5D",["dash"],28,22,15,0],
		"1f4a9":[["\uD83D\uDCA9"],"\uE05A","\uDBB9\uDCF4",["hankey","poop","shit"],28,23,15,0],
		"1f4aa":[["\uD83D\uDCAA"],"\uE14C","\uDBBA\uDF5E",["muscle"],28,24,15,0],
		"1f4ab":[["\uD83D\uDCAB"],"","\uDBBA\uDF5F",["dizzy"],28,30,15,0],
		"1f4ac":[["\uD83D\uDCAC"],"","\uDBB9\uDD32",["speech_balloon"],28,31,15,0],
		"1f4ad":[["\uD83D\uDCAD"],"","",["thought_balloon"],28,32,15,0],
		"1f4ae":[["\uD83D\uDCAE"],"","\uDBBA\uDF7A",["white_flower"],28,33,15,0],
		"1f4af":[["\uD83D\uDCAF"],"","\uDBBA\uDF7B",["100"],28,34,15,0],
		"1f4b0":[["\uD83D\uDCB0"],"\uE12F","\uDBB9\uDCDD",["moneybag"],28,35,15,0],
		"1f4b1":[["\uD83D\uDCB1"],"\uE149","\uDBB9\uDCDE",["currency_exchange"],28,36,15,0],
		"1f4b2":[["\uD83D\uDCB2"],"","\uDBB9\uDCE0",["heavy_dollar_sign"],28,37,15,0],
		"1f4b3":[["\uD83D\uDCB3"],"","\uDBB9\uDCE1",["credit_card"],28,38,15,0],
		"1f4b4":[["\uD83D\uDCB4"],"","\uDBB9\uDCE2",["yen"],28,39,15,0],
		"1f4b5":[["\uD83D\uDCB5"],"","\uDBB9\uDCE3",["dollar"],28,40,15,0],
		"1f4b6":[["\uD83D\uDCB6"],"","",["euro"],28,41,15,0],
		"1f4b7":[["\uD83D\uDCB7"],"","",["pound"],28,42,15,0],
		"1f4b8":[["\uD83D\uDCB8"],"","\uDBB9\uDCE4",["money_with_wings"],28,43,15,0],
		"1f4b9":[["\uD83D\uDCB9"],"\uE14A","\uDBB9\uDCDF",["chart"],28,44,15,0],
		"1f4ba":[["\uD83D\uDCBA"],"\uE11F","\uDBB9\uDD37",["seat"],28,45,15,0],
		"1f4bb":[["\uD83D\uDCBB"],"\uE00C","\uDBB9\uDD38",["computer"],28,46,15,0],
		"1f4bc":[["\uD83D\uDCBC"],"\uE11E","\uDBB9\uDD3B",["briefcase"],28,47,15,0],
		"1f4bd":[["\uD83D\uDCBD"],"\uE316","\uDBB9\uDD3C",["minidisc"],28,48,15,0],
		"1f4be":[["\uD83D\uDCBE"],"","\uDBB9\uDD3D",["floppy_disk"],28,49,15,0],
		"1f4bf":[["\uD83D\uDCBF"],"\uE126","\uDBBA\uDC1D",["cd"],28,50,15,0],
		"1f4c0":[["\uD83D\uDCC0"],"\uE127","\uDBBA\uDC1E",["dvd"],28,51,15,0],
		"1f4c1":[["\uD83D\uDCC1"],"","\uDBB9\uDD43",["file_folder"],28,52,15,0],
		"1f4c2":[["\uD83D\uDCC2"],"","\uDBB9\uDD44",["open_file_folder"],28,53,15,0],
		"1f4c3":[["\uD83D\uDCC3"],"","\uDBB9\uDD40",["page_with_curl"],28,54,15,0],
		"1f4c4":[["\uD83D\uDCC4"],"","\uDBB9\uDD41",["page_facing_up"],28,55,15,0],
		"1f4c5":[["\uD83D\uDCC5"],"","\uDBB9\uDD42",["date"],28,56,15,0],
		"1f4c6":[["\uD83D\uDCC6"],"","\uDBB9\uDD49",["calendar"],28,57,15,0],
		"1f4c7":[["\uD83D\uDCC7"],"","\uDBB9\uDD4D",["card_index"],28,58,15,0],
		"1f4c8":[["\uD83D\uDCC8"],"","\uDBB9\uDD4B",["chart_with_upwards_trend"],28,59,15,0],
		"1f4c9":[["\uD83D\uDCC9"],"","\uDBB9\uDD4C",["chart_with_downwards_trend"],29,0,15,0],
		"1f4ca":[["\uD83D\uDCCA"],"","\uDBB9\uDD4A",["bar_chart"],29,1,15,0],
		"1f4cb":[["\uD83D\uDCCB"],"","\uDBB9\uDD48",["clipboard"],29,2,15,0],
		"1f4cc":[["\uD83D\uDCCC"],"","\uDBB9\uDD4E",["pushpin"],29,3,15,0],
		"1f4cd":[["\uD83D\uDCCD"],"","\uDBB9\uDD3F",["round_pushpin"],29,4,15,0],
		"1f4ce":[["\uD83D\uDCCE"],"","\uDBB9\uDD3A",["paperclip"],29,5,15,0],
		"1f4cf":[["\uD83D\uDCCF"],"","\uDBB9\uDD50",["straight_ruler"],29,6,15,0],
		"1f4d0":[["\uD83D\uDCD0"],"","\uDBB9\uDD51",["triangular_ruler"],29,7,15,0],
		"1f4d1":[["\uD83D\uDCD1"],"","\uDBB9\uDD52",["bookmark_tabs"],29,8,15,0],
		"1f4d2":[["\uD83D\uDCD2"],"","\uDBB9\uDD4F",["ledger"],29,9,15,0],
		"1f4d3":[["\uD83D\uDCD3"],"","\uDBB9\uDD45",["notebook"],29,10,15,0],
		"1f4d4":[["\uD83D\uDCD4"],"","\uDBB9\uDD47",["notebook_with_decorative_cover"],29,11,15,0],
		"1f4d5":[["\uD83D\uDCD5"],"","\uDBB9\uDD02",["closed_book"],29,12,15,0],
		"1f4d6":[["\uD83D\uDCD6"],"\uE148","\uDBB9\uDD46",["book","open_book"],29,13,15,0],
		"1f4d7":[["\uD83D\uDCD7"],"","\uDBB9\uDCFF",["green_book"],29,14,15,0],
		"1f4d8":[["\uD83D\uDCD8"],"","\uDBB9\uDD00",["blue_book"],29,15,15,0],
		"1f4d9":[["\uD83D\uDCD9"],"","\uDBB9\uDD01",["orange_book"],29,16,15,0],
		"1f4da":[["\uD83D\uDCDA"],"","\uDBB9\uDD03",["books"],29,17,15,0],
		"1f4db":[["\uD83D\uDCDB"],"","\uDBB9\uDD04",["name_badge"],29,18,15,0],
		"1f4dc":[["\uD83D\uDCDC"],"","\uDBB9\uDCFD",["scroll"],29,19,15,0],
		"1f4dd":[["\uD83D\uDCDD"],"\uE301","\uDBB9\uDD27",["memo","pencil"],29,20,15,0],
		"1f4de":[["\uD83D\uDCDE"],"","\uDBB9\uDD24",["telephone_receiver"],29,21,15,0],
		"1f4df":[["\uD83D\uDCDF"],"","\uDBB9\uDD22",["pager"],29,22,15,0],
		"1f4e0":[["\uD83D\uDCE0"],"\uE00B","\uDBB9\uDD28",["fax"],29,23,15,0],
		"1f4e1":[["\uD83D\uDCE1"],"\uE14B","\uDBB9\uDD31",["satellite_antenna"],29,24,15,0],
		"1f4e2":[["\uD83D\uDCE2"],"\uE142","\uDBB9\uDD2F",["loudspeaker"],29,25,15,0],
		"1f4e3":[["\uD83D\uDCE3"],"\uE317","\uDBB9\uDD30",["mega"],29,26,15,0],
		"1f4e4":[["\uD83D\uDCE4"],"","\uDBB9\uDD33",["outbox_tray"],29,27,15,0],
		"1f4e5":[["\uD83D\uDCE5"],"","\uDBB9\uDD34",["inbox_tray"],29,28,15,0],
		"1f4e6":[["\uD83D\uDCE6"],"","\uDBB9\uDD35",["package"],29,29,15,0],
		"1f4e7":[["\uD83D\uDCE7"],"","\uDBBA\uDF92",["e-mail"],29,30,15,0],
		"1f4e8":[["\uD83D\uDCE8"],"","\uDBB9\uDD2A",["incoming_envelope"],29,31,15,0],
		"1f4e9":[["\uD83D\uDCE9"],"\uE103","\uDBB9\uDD2B",["envelope_with_arrow"],29,32,15,0],
		"1f4ea":[["\uD83D\uDCEA"],"","\uDBB9\uDD2C",["mailbox_closed"],29,33,15,0],
		"1f4eb":[["\uD83D\uDCEB"],"\uE101","\uDBB9\uDD2D",["mailbox"],29,34,15,0],
		"1f4ec":[["\uD83D\uDCEC"],"","",["mailbox_with_mail"],29,35,15,0],
		"1f4ed":[["\uD83D\uDCED"],"","",["mailbox_with_no_mail"],29,36,15,0],
		"1f4ee":[["\uD83D\uDCEE"],"\uE102","\uDBB9\uDD2E",["postbox"],29,37,15,0],
		"1f4ef":[["\uD83D\uDCEF"],"","",["postal_horn"],29,38,15,0],
		"1f4f0":[["\uD83D\uDCF0"],"","\uDBBA\uDC22",["newspaper"],29,39,15,0],
		"1f4f1":[["\uD83D\uDCF1"],"\uE00A","\uDBB9\uDD25",["iphone"],29,40,15,0],
		"1f4f2":[["\uD83D\uDCF2"],"\uE104","\uDBB9\uDD26",["calling"],29,41,15,0],
		"1f4f3":[["\uD83D\uDCF3"],"\uE250","\uDBBA\uDC39",["vibration_mode"],29,42,15,0],
		"1f4f4":[["\uD83D\uDCF4"],"\uE251","\uDBBA\uDC3A",["mobile_phone_off"],29,43,15,0],
		"1f4f5":[["\uD83D\uDCF5"],"","",["no_mobile_phones"],29,44,15,0],
		"1f4f6":[["\uD83D\uDCF6"],"\uE20B","\uDBBA\uDC38",["signal_strength"],29,45,15,0],
		"1f4f7":[["\uD83D\uDCF7"],"\uE008","\uDBB9\uDCEF",["camera"],29,46,15,0],
		"1f4f8":[["\uD83D\uDCF8"],"","",["camera_with_flash"],29,47,15,0],
		"1f4f9":[["\uD83D\uDCF9"],"","\uDBB9\uDCF9",["video_camera"],29,48,15,0],
		"1f4fa":[["\uD83D\uDCFA"],"\uE12A","\uDBBA\uDC1C",["tv"],29,49,15,0],
		"1f4fb":[["\uD83D\uDCFB"],"\uE128","\uDBBA\uDC1F",["radio"],29,50,15,0],
		"1f4fc":[["\uD83D\uDCFC"],"\uE129","\uDBBA\uDC20",["vhs"],29,51,15,0],
		"1f4fd-fe0f":[["\uD83D\uDCFD\uFE0F","\uD83D\uDCFD"],"","",["film_projector"],29,52,15,0],
		"1f4ff":[["\uD83D\uDCFF"],"","",["prayer_beads"],29,53,15,0],
		"1f500":[["\uD83D\uDD00"],"","",["twisted_rightwards_arrows"],29,54,15,0],
		"1f501":[["\uD83D\uDD01"],"","",["repeat"],29,55,15,0],
		"1f502":[["\uD83D\uDD02"],"","",["repeat_one"],29,56,15,0],
		"1f503":[["\uD83D\uDD03"],"","\uDBBA\uDF91",["arrows_clockwise"],29,57,15,0],
		"1f504":[["\uD83D\uDD04"],"","",["arrows_counterclockwise"],29,58,15,0],
		"1f505":[["\uD83D\uDD05"],"","",["low_brightness"],29,59,15,0],
		"1f506":[["\uD83D\uDD06"],"","",["high_brightness"],30,0,15,0],
		"1f507":[["\uD83D\uDD07"],"","",["mute"],30,1,15,0],
		"1f508":[["\uD83D\uDD08"],"","",["speaker"],30,2,15,0],
		"1f509":[["\uD83D\uDD09"],"","",["sound"],30,3,15,0],
		"1f50a":[["\uD83D\uDD0A"],"\uE141","\uDBBA\uDC21",["loud_sound"],30,4,15,0],
		"1f50b":[["\uD83D\uDD0B"],"","\uDBB9\uDCFC",["battery"],30,5,15,0],
		"1f50c":[["\uD83D\uDD0C"],"","\uDBB9\uDCFE",["electric_plug"],30,6,15,0],
		"1f50d":[["\uD83D\uDD0D"],"\uE114","\uDBBA\uDF85",["mag"],30,7,15,0],
		"1f50e":[["\uD83D\uDD0E"],"","\uDBBA\uDF8D",["mag_right"],30,8,15,0],
		"1f50f":[["\uD83D\uDD0F"],"","\uDBBA\uDF90",["lock_with_ink_pen"],30,9,15,0],
		"1f510":[["\uD83D\uDD10"],"","\uDBBA\uDF8A",["closed_lock_with_key"],30,10,15,0],
		"1f511":[["\uD83D\uDD11"],"\uE03F","\uDBBA\uDF82",["key"],30,11,15,0],
		"1f512":[["\uD83D\uDD12"],"\uE144","\uDBBA\uDF86",["lock"],30,12,15,0],
		"1f513":[["\uD83D\uDD13"],"\uE145","\uDBBA\uDF87",["unlock"],30,13,15,0],
		"1f514":[["\uD83D\uDD14"],"\uE325","\uDBB9\uDCF2",["bell"],30,14,15,0],
		"1f515":[["\uD83D\uDD15"],"","",["no_bell"],30,15,15,0],
		"1f516":[["\uD83D\uDD16"],"","\uDBBA\uDF8F",["bookmark"],30,16,15,0],
		"1f517":[["\uD83D\uDD17"],"","\uDBBA\uDF4B",["link"],30,17,15,0],
		"1f518":[["\uD83D\uDD18"],"","\uDBBA\uDF8C",["radio_button"],30,18,15,0],
		"1f519":[["\uD83D\uDD19"],"","\uDBBA\uDF8E",["back"],30,19,15,0],
		"1f51a":[["\uD83D\uDD1A"],"","\uDBB8\uDC1A",["end"],30,20,15,0],
		"1f51b":[["\uD83D\uDD1B"],"","\uDBB8\uDC19",["on"],30,21,15,0],
		"1f51c":[["\uD83D\uDD1C"],"","\uDBB8\uDC18",["soon"],30,22,15,0],
		"1f51d":[["\uD83D\uDD1D"],"\uE24C","\uDBBA\uDF42",["top"],30,23,15,0],
		"1f51e":[["\uD83D\uDD1E"],"\uE207","\uDBBA\uDF25",["underage"],30,24,15,0],
		"1f51f":[["\uD83D\uDD1F"],"","\uDBBA\uDC3B",["keycap_ten"],30,25,15,0],
		"1f520":[["\uD83D\uDD20"],"","\uDBBA\uDF7C",["capital_abcd"],30,26,15,0],
		"1f521":[["\uD83D\uDD21"],"","\uDBBA\uDF7D",["abcd"],30,27,15,0],
		"1f522":[["\uD83D\uDD22"],"","\uDBBA\uDF7E",["1234"],30,28,15,0],
		"1f523":[["\uD83D\uDD23"],"","\uDBBA\uDF7F",["symbols"],30,29,15,0],
		"1f524":[["\uD83D\uDD24"],"","\uDBBA\uDF80",["abc"],30,30,15,0],
		"1f525":[["\uD83D\uDD25"],"\uE11D","\uDBB9\uDCF6",["fire"],30,31,15,0],
		"1f526":[["\uD83D\uDD26"],"","\uDBB9\uDCFB",["flashlight"],30,32,15,0],
		"1f527":[["\uD83D\uDD27"],"","\uDBB9\uDCC9",["wrench"],30,33,15,0],
		"1f528":[["\uD83D\uDD28"],"\uE116","\uDBB9\uDCCA",["hammer"],30,34,15,0],
		"1f529":[["\uD83D\uDD29"],"","\uDBB9\uDCCB",["nut_and_bolt"],30,35,15,0],
		"1f52a":[["\uD83D\uDD2A"],"","\uDBB9\uDCFA",["hocho","knife"],30,36,15,0],
		"1f52b":[["\uD83D\uDD2B"],"\uE113","\uDBB9\uDCF5",["gun"],30,37,15,0],
		"1f52c":[["\uD83D\uDD2C"],"","",["microscope"],30,38,15,0],
		"1f52d":[["\uD83D\uDD2D"],"","",["telescope"],30,39,15,0],
		"1f52e":[["\uD83D\uDD2E"],"","\uDBB9\uDCF7",["crystal_ball"],30,40,15,0],
		"1f52f":[["\uD83D\uDD2F"],"\uE23E","\uDBB9\uDCF8",["six_pointed_star"],30,41,15,0],
		"1f530":[["\uD83D\uDD30"],"\uE209","\uDBB8\uDC44",["beginner"],30,42,15,0],
		"1f531":[["\uD83D\uDD31"],"\uE031","\uDBB9\uDCD2",["trident"],30,43,15,0],
		"1f532":[["\uD83D\uDD32"],"\uE21A","\uDBBA\uDF64",["black_square_button"],30,44,15,0],
		"1f533":[["\uD83D\uDD33"],"\uE21B","\uDBBA\uDF67",["white_square_button"],30,45,15,0],
		"1f534":[["\uD83D\uDD34"],"\uE219","\uDBBA\uDF63",["red_circle"],30,46,15,0],
		"1f535":[["\uD83D\uDD35"],"","\uDBBA\uDF64",["large_blue_circle"],30,47,15,0],
		"1f536":[["\uD83D\uDD36"],"","\uDBBA\uDF73",["large_orange_diamond"],30,48,15,0],
		"1f537":[["\uD83D\uDD37"],"","\uDBBA\uDF74",["large_blue_diamond"],30,49,15,0],
		"1f538":[["\uD83D\uDD38"],"","\uDBBA\uDF75",["small_orange_diamond"],30,50,15,0],
		"1f539":[["\uD83D\uDD39"],"","\uDBBA\uDF76",["small_blue_diamond"],30,51,15,0],
		"1f53a":[["\uD83D\uDD3A"],"","\uDBBA\uDF78",["small_red_triangle"],30,52,15,0],
		"1f53b":[["\uD83D\uDD3B"],"","\uDBBA\uDF79",["small_red_triangle_down"],30,53,15,0],
		"1f53c":[["\uD83D\uDD3C"],"","\uDBBA\uDF01",["arrow_up_small"],30,54,15,0],
		"1f53d":[["\uD83D\uDD3D"],"","\uDBBA\uDF00",["arrow_down_small"],30,55,15,0],
		"1f549-fe0f":[["\uD83D\uDD49\uFE0F","\uD83D\uDD49"],"","",["om_symbol"],30,56,15,0],
		"1f54a-fe0f":[["\uD83D\uDD4A\uFE0F","\uD83D\uDD4A"],"","",["dove_of_peace"],30,57,15,0],
		"1f54b":[["\uD83D\uDD4B"],"","",["kaaba"],30,58,15,0],
		"1f54c":[["\uD83D\uDD4C"],"","",["mosque"],30,59,15,0],
		"1f54d":[["\uD83D\uDD4D"],"","",["synagogue"],31,0,15,0],
		"1f54e":[["\uD83D\uDD4E"],"","",["menorah_with_nine_branches"],31,1,15,0],
		"1f550":[["\uD83D\uDD50"],"\uE024","\uDBB8\uDC1E",["clock1"],31,2,15,0],
		"1f551":[["\uD83D\uDD51"],"\uE025","\uDBB8\uDC1F",["clock2"],31,3,15,0],
		"1f552":[["\uD83D\uDD52"],"\uE026","\uDBB8\uDC20",["clock3"],31,4,15,0],
		"1f553":[["\uD83D\uDD53"],"\uE027","\uDBB8\uDC21",["clock4"],31,5,15,0],
		"1f554":[["\uD83D\uDD54"],"\uE028","\uDBB8\uDC22",["clock5"],31,6,15,0],
		"1f555":[["\uD83D\uDD55"],"\uE029","\uDBB8\uDC23",["clock6"],31,7,15,0],
		"1f556":[["\uD83D\uDD56"],"\uE02A","\uDBB8\uDC24",["clock7"],31,8,15,0],
		"1f557":[["\uD83D\uDD57"],"\uE02B","\uDBB8\uDC25",["clock8"],31,9,15,0],
		"1f558":[["\uD83D\uDD58"],"\uE02C","\uDBB8\uDC26",["clock9"],31,10,15,0],
		"1f559":[["\uD83D\uDD59"],"\uE02D","\uDBB8\uDC27",["clock10"],31,11,15,0],
		"1f55a":[["\uD83D\uDD5A"],"\uE02E","\uDBB8\uDC28",["clock11"],31,12,15,0],
		"1f55b":[["\uD83D\uDD5B"],"\uE02F","\uDBB8\uDC29",["clock12"],31,13,15,0],
		"1f55c":[["\uD83D\uDD5C"],"","",["clock130"],31,14,15,0],
		"1f55d":[["\uD83D\uDD5D"],"","",["clock230"],31,15,15,0],
		"1f55e":[["\uD83D\uDD5E"],"","",["clock330"],31,16,15,0],
		"1f55f":[["\uD83D\uDD5F"],"","",["clock430"],31,17,15,0],
		"1f560":[["\uD83D\uDD60"],"","",["clock530"],31,18,15,0],
		"1f561":[["\uD83D\uDD61"],"","",["clock630"],31,19,15,0],
		"1f562":[["\uD83D\uDD62"],"","",["clock730"],31,20,15,0],
		"1f563":[["\uD83D\uDD63"],"","",["clock830"],31,21,15,0],
		"1f564":[["\uD83D\uDD64"],"","",["clock930"],31,22,15,0],
		"1f565":[["\uD83D\uDD65"],"","",["clock1030"],31,23,15,0],
		"1f566":[["\uD83D\uDD66"],"","",["clock1130"],31,24,15,0],
		"1f567":[["\uD83D\uDD67"],"","",["clock1230"],31,25,15,0],
		"1f56f-fe0f":[["\uD83D\uDD6F\uFE0F","\uD83D\uDD6F"],"","",["candle"],31,26,15,0],
		"1f570-fe0f":[["\uD83D\uDD70\uFE0F","\uD83D\uDD70"],"","",["mantelpiece_clock"],31,27,15,0],
		"1f573-fe0f":[["\uD83D\uDD73\uFE0F","\uD83D\uDD73"],"","",["hole"],31,28,15,0],
		"1f574-fe0f":[["\uD83D\uDD74\uFE0F","\uD83D\uDD74"],"","",["man_in_business_suit_levitating"],31,29,15,0],
		"1f575-fe0f-200d-2640-fe0f":[["\uD83D\uDD75\uFE0F\u200D\u2640\uFE0F"],"","",["female-detective"],31,35,7,0],
		"1f575-fe0f-200d-2642-fe0f":[["\uD83D\uDD75\uFE0F\u200D\u2642\uFE0F","\uD83D\uDD75\uFE0F","\uD83D\uDD75"],"","",["male-detective","sleuth_or_spy"],31,41,7,0],
		"1f576-fe0f":[["\uD83D\uDD76\uFE0F","\uD83D\uDD76"],"","",["dark_sunglasses"],31,53,15,0],
		"1f577-fe0f":[["\uD83D\uDD77\uFE0F","\uD83D\uDD77"],"","",["spider"],31,54,15,0],
		"1f578-fe0f":[["\uD83D\uDD78\uFE0F","\uD83D\uDD78"],"","",["spider_web"],31,55,15,0],
		"1f579-fe0f":[["\uD83D\uDD79\uFE0F","\uD83D\uDD79"],"","",["joystick"],31,56,15,0],
		"1f57a":[["\uD83D\uDD7A"],"","",["man_dancing"],31,57,15,0],
		"1f587-fe0f":[["\uD83D\uDD87\uFE0F","\uD83D\uDD87"],"","",["linked_paperclips"],32,3,15,0],
		"1f58a-fe0f":[["\uD83D\uDD8A\uFE0F","\uD83D\uDD8A"],"","",["lower_left_ballpoint_pen"],32,4,15,0],
		"1f58b-fe0f":[["\uD83D\uDD8B\uFE0F","\uD83D\uDD8B"],"","",["lower_left_fountain_pen"],32,5,15,0],
		"1f58c-fe0f":[["\uD83D\uDD8C\uFE0F","\uD83D\uDD8C"],"","",["lower_left_paintbrush"],32,6,15,0],
		"1f58d-fe0f":[["\uD83D\uDD8D\uFE0F","\uD83D\uDD8D"],"","",["lower_left_crayon"],32,7,15,0],
		"1f590-fe0f":[["\uD83D\uDD90\uFE0F","\uD83D\uDD90"],"","",["raised_hand_with_fingers_splayed"],32,8,15,0],
		"1f595":[["\uD83D\uDD95"],"","",["middle_finger","reversed_hand_with_middle_finger_extended"],32,14,15,0],
		"1f596":[["\uD83D\uDD96"],"","",["spock-hand"],32,20,15,0],
		"1f5a4":[["\uD83D\uDDA4"],"","",["black_heart"],32,26,15,0],
		"1f5a5-fe0f":[["\uD83D\uDDA5\uFE0F","\uD83D\uDDA5"],"","",["desktop_computer"],32,27,15,0],
		"1f5a8-fe0f":[["\uD83D\uDDA8\uFE0F","\uD83D\uDDA8"],"","",["printer"],32,28,15,0],
		"1f5b1-fe0f":[["\uD83D\uDDB1\uFE0F","\uD83D\uDDB1"],"","",["three_button_mouse"],32,29,15,0],
		"1f5b2-fe0f":[["\uD83D\uDDB2\uFE0F","\uD83D\uDDB2"],"","",["trackball"],32,30,15,0],
		"1f5bc-fe0f":[["\uD83D\uDDBC\uFE0F","\uD83D\uDDBC"],"","",["frame_with_picture"],32,31,15,0],
		"1f5c2-fe0f":[["\uD83D\uDDC2\uFE0F","\uD83D\uDDC2"],"","",["card_index_dividers"],32,32,15,0],
		"1f5c3-fe0f":[["\uD83D\uDDC3\uFE0F","\uD83D\uDDC3"],"","",["card_file_box"],32,33,15,0],
		"1f5c4-fe0f":[["\uD83D\uDDC4\uFE0F","\uD83D\uDDC4"],"","",["file_cabinet"],32,34,15,0],
		"1f5d1-fe0f":[["\uD83D\uDDD1\uFE0F","\uD83D\uDDD1"],"","",["wastebasket"],32,35,15,0],
		"1f5d2-fe0f":[["\uD83D\uDDD2\uFE0F","\uD83D\uDDD2"],"","",["spiral_note_pad"],32,36,15,0],
		"1f5d3-fe0f":[["\uD83D\uDDD3\uFE0F","\uD83D\uDDD3"],"","",["spiral_calendar_pad"],32,37,15,0],
		"1f5dc-fe0f":[["\uD83D\uDDDC\uFE0F","\uD83D\uDDDC"],"","",["compression"],32,38,15,0],
		"1f5dd-fe0f":[["\uD83D\uDDDD\uFE0F","\uD83D\uDDDD"],"","",["old_key"],32,39,15,0],
		"1f5de-fe0f":[["\uD83D\uDDDE\uFE0F","\uD83D\uDDDE"],"","",["rolled_up_newspaper"],32,40,15,0],
		"1f5e1-fe0f":[["\uD83D\uDDE1\uFE0F","\uD83D\uDDE1"],"","",["dagger_knife"],32,41,15,0],
		"1f5e3-fe0f":[["\uD83D\uDDE3\uFE0F","\uD83D\uDDE3"],"","",["speaking_head_in_silhouette"],32,42,15,0],
		"1f5e8-fe0f":[["\uD83D\uDDE8\uFE0F","\uD83D\uDDE8"],"","",["left_speech_bubble"],32,43,15,0],
		"1f5ef-fe0f":[["\uD83D\uDDEF\uFE0F","\uD83D\uDDEF"],"","",["right_anger_bubble"],32,44,15,0],
		"1f5f3-fe0f":[["\uD83D\uDDF3\uFE0F","\uD83D\uDDF3"],"","",["ballot_box_with_ballot"],32,45,15,0],
		"1f5fa-fe0f":[["\uD83D\uDDFA\uFE0F","\uD83D\uDDFA"],"","",["world_map"],32,46,15,0],
		"1f5fb":[["\uD83D\uDDFB"],"\uE03B","\uDBB9\uDCC3",["mount_fuji"],32,47,15,0],
		"1f5fc":[["\uD83D\uDDFC"],"\uE509","\uDBB9\uDCC4",["tokyo_tower"],32,48,15,0],
		"1f5fd":[["\uD83D\uDDFD"],"\uE51D","\uDBB9\uDCC6",["statue_of_liberty"],32,49,15,0],
		"1f5fe":[["\uD83D\uDDFE"],"","\uDBB9\uDCC7",["japan"],32,50,15,0],
		"1f5ff":[["\uD83D\uDDFF"],"","\uDBB9\uDCC8",["moyai"],32,51,15,0],
		"1f600":[["\uD83D\uDE00"],"","",["grinning"],32,52,15,0,":D"],
		"1f601":[["\uD83D\uDE01"],"\uE404","\uDBB8\uDF33",["grin"],32,53,15,0],
		"1f602":[["\uD83D\uDE02"],"\uE412","\uDBB8\uDF34",["joy"],32,54,15,0],
		"1f603":[["\uD83D\uDE03"],"\uE057","\uDBB8\uDF30",["smiley"],32,55,15,0,":)"],
		"1f604":[["\uD83D\uDE04"],"\uE415","\uDBB8\uDF38",["smile"],32,56,15,0,":)"],
		"1f605":[["\uD83D\uDE05"],"","\uDBB8\uDF31",["sweat_smile"],32,57,15,0],
		"1f606":[["\uD83D\uDE06"],"","\uDBB8\uDF32",["laughing","satisfied"],32,58,15,0],
		"1f607":[["\uD83D\uDE07"],"","",["innocent"],32,59,15,0],
		"1f608":[["\uD83D\uDE08"],"","",["smiling_imp"],33,0,15,0],
		"1f609":[["\uD83D\uDE09"],"\uE405","\uDBB8\uDF47",["wink"],33,1,15,0,";)"],
		"1f60a":[["\uD83D\uDE0A"],"\uE056","\uDBB8\uDF35",["blush"],33,2,15,0,":)"],
		"1f60b":[["\uD83D\uDE0B"],"","\uDBB8\uDF2B",["yum"],33,3,15,0],
		"1f60c":[["\uD83D\uDE0C"],"\uE40A","\uDBB8\uDF3E",["relieved"],33,4,15,0],
		"1f60d":[["\uD83D\uDE0D"],"\uE106","\uDBB8\uDF27",["heart_eyes"],33,5,15,0],
		"1f60e":[["\uD83D\uDE0E"],"","",["sunglasses"],33,6,15,0],
		"1f60f":[["\uD83D\uDE0F"],"\uE402","\uDBB8\uDF43",["smirk"],33,7,15,0],
		"1f610":[["\uD83D\uDE10"],"","",["neutral_face"],33,8,15,0],
		"1f611":[["\uD83D\uDE11"],"","",["expressionless"],33,9,15,0],
		"1f612":[["\uD83D\uDE12"],"\uE40E","\uDBB8\uDF26",["unamused"],33,10,15,0,":("],
		"1f613":[["\uD83D\uDE13"],"\uE108","\uDBB8\uDF44",["sweat"],33,11,15,0],
		"1f614":[["\uD83D\uDE14"],"\uE403","\uDBB8\uDF40",["pensive"],33,12,15,0],
		"1f615":[["\uD83D\uDE15"],"","",["confused"],33,13,15,0],
		"1f616":[["\uD83D\uDE16"],"\uE407","\uDBB8\uDF3F",["confounded"],33,14,15,0],
		"1f617":[["\uD83D\uDE17"],"","",["kissing"],33,15,15,0],
		"1f618":[["\uD83D\uDE18"],"\uE418","\uDBB8\uDF2C",["kissing_heart"],33,16,15,0],
		"1f619":[["\uD83D\uDE19"],"","",["kissing_smiling_eyes"],33,17,15,0],
		"1f61a":[["\uD83D\uDE1A"],"\uE417","\uDBB8\uDF2D",["kissing_closed_eyes"],33,18,15,0],
		"1f61b":[["\uD83D\uDE1B"],"","",["stuck_out_tongue"],33,19,15,0,":p"],
		"1f61c":[["\uD83D\uDE1C"],"\uE105","\uDBB8\uDF29",["stuck_out_tongue_winking_eye"],33,20,15,0,";p"],
		"1f61d":[["\uD83D\uDE1D"],"\uE409","\uDBB8\uDF2A",["stuck_out_tongue_closed_eyes"],33,21,15,0],
		"1f61e":[["\uD83D\uDE1E"],"\uE058","\uDBB8\uDF23",["disappointed"],33,22,15,0,":("],
		"1f61f":[["\uD83D\uDE1F"],"","",["worried"],33,23,15,0],
		"1f620":[["\uD83D\uDE20"],"\uE059","\uDBB8\uDF20",["angry"],33,24,15,0],
		"1f621":[["\uD83D\uDE21"],"\uE416","\uDBB8\uDF3D",["rage"],33,25,15,0],
		"1f622":[["\uD83D\uDE22"],"\uE413","\uDBB8\uDF39",["cry"],33,26,15,0,":'("],
		"1f623":[["\uD83D\uDE23"],"\uE406","\uDBB8\uDF3C",["persevere"],33,27,15,0],
		"1f624":[["\uD83D\uDE24"],"","\uDBB8\uDF28",["triumph"],33,28,15,0],
		"1f625":[["\uD83D\uDE25"],"\uE401","\uDBB8\uDF45",["disappointed_relieved"],33,29,15,0],
		"1f626":[["\uD83D\uDE26"],"","",["frowning"],33,30,15,0],
		"1f627":[["\uD83D\uDE27"],"","",["anguished"],33,31,15,0],
		"1f628":[["\uD83D\uDE28"],"\uE40B","\uDBB8\uDF3B",["fearful"],33,32,15,0],
		"1f629":[["\uD83D\uDE29"],"","\uDBB8\uDF21",["weary"],33,33,15,0],
		"1f62a":[["\uD83D\uDE2A"],"\uE408","\uDBB8\uDF42",["sleepy"],33,34,15,0],
		"1f62b":[["\uD83D\uDE2B"],"","\uDBB8\uDF46",["tired_face"],33,35,15,0],
		"1f62c":[["\uD83D\uDE2C"],"","",["grimacing"],33,36,15,0],
		"1f62d":[["\uD83D\uDE2D"],"\uE411","\uDBB8\uDF3A",["sob"],33,37,15,0,":'("],
		"1f62e-200d-1f4a8":[["\uD83D\uDE2E\u200D\uD83D\uDCA8"],"","",["face_exhaling"],33,38,7,0],
		"1f62e":[["\uD83D\uDE2E"],"","",["open_mouth"],33,39,15,0],
		"1f62f":[["\uD83D\uDE2F"],"","",["hushed"],33,40,15,0],
		"1f630":[["\uD83D\uDE30"],"\uE40F","\uDBB8\uDF25",["cold_sweat"],33,41,15,0],
		"1f631":[["\uD83D\uDE31"],"\uE107","\uDBB8\uDF41",["scream"],33,42,15,0],
		"1f632":[["\uD83D\uDE32"],"\uE410","\uDBB8\uDF22",["astonished"],33,43,15,0],
		"1f633":[["\uD83D\uDE33"],"\uE40D","\uDBB8\uDF2F",["flushed"],33,44,15,0],
		"1f634":[["\uD83D\uDE34"],"","",["sleeping"],33,45,15,0],
		"1f635-200d-1f4ab":[["\uD83D\uDE35\u200D\uD83D\uDCAB"],"","",["face_with_spiral_eyes"],33,46,7,0],
		"1f635":[["\uD83D\uDE35"],"","\uDBB8\uDF24",["dizzy_face"],33,47,15,0],
		"1f636-200d-1f32b-fe0f":[["\uD83D\uDE36\u200D\uD83C\uDF2B\uFE0F","\uD83D\uDE36\u200D\uD83C\uDF2B"],"","",["face_in_clouds"],33,48,7,0],
		"1f636":[["\uD83D\uDE36"],"","",["no_mouth"],33,49,15,0],
		"1f637":[["\uD83D\uDE37"],"\uE40C","\uDBB8\uDF2E",["mask"],33,50,15,0],
		"1f638":[["\uD83D\uDE38"],"","\uDBB8\uDF49",["smile_cat"],33,51,15,0],
		"1f639":[["\uD83D\uDE39"],"","\uDBB8\uDF4A",["joy_cat"],33,52,15,0],
		"1f63a":[["\uD83D\uDE3A"],"","\uDBB8\uDF48",["smiley_cat"],33,53,15,0],
		"1f63b":[["\uD83D\uDE3B"],"","\uDBB8\uDF4C",["heart_eyes_cat"],33,54,15,0],
		"1f63c":[["\uD83D\uDE3C"],"","\uDBB8\uDF4F",["smirk_cat"],33,55,15,0],
		"1f63d":[["\uD83D\uDE3D"],"","\uDBB8\uDF4B",["kissing_cat"],33,56,15,0],
		"1f63e":[["\uD83D\uDE3E"],"","\uDBB8\uDF4E",["pouting_cat"],33,57,15,0],
		"1f63f":[["\uD83D\uDE3F"],"","\uDBB8\uDF4D",["crying_cat_face"],33,58,15,0],
		"1f640":[["\uD83D\uDE40"],"","\uDBB8\uDF50",["scream_cat"],33,59,15,0],
		"1f641":[["\uD83D\uDE41"],"","",["slightly_frowning_face"],34,0,15,0],
		"1f642":[["\uD83D\uDE42"],"","",["slightly_smiling_face"],34,1,15,0],
		"1f643":[["\uD83D\uDE43"],"","",["upside_down_face"],34,2,15,0],
		"1f644":[["\uD83D\uDE44"],"","",["face_with_rolling_eyes"],34,3,15,0],
		"1f645-200d-2640-fe0f":[["\uD83D\uDE45\u200D\u2640\uFE0F","\uD83D\uDE45\u200D\u2640","\uD83D\uDE45"],"","",["woman-gesturing-no","no_good"],34,4,15,0],
		"1f645-200d-2642-fe0f":[["\uD83D\uDE45\u200D\u2642\uFE0F","\uD83D\uDE45\u200D\u2642"],"","",["man-gesturing-no"],34,10,15,0],
		"1f646-200d-2640-fe0f":[["\uD83D\uDE46\u200D\u2640\uFE0F","\uD83D\uDE46\u200D\u2640","\uD83D\uDE46"],"","",["woman-gesturing-ok","ok_woman"],34,22,15,0],
		"1f646-200d-2642-fe0f":[["\uD83D\uDE46\u200D\u2642\uFE0F","\uD83D\uDE46\u200D\u2642"],"","",["man-gesturing-ok"],34,28,15,0],
		"1f647-200d-2640-fe0f":[["\uD83D\uDE47\u200D\u2640\uFE0F","\uD83D\uDE47\u200D\u2640"],"","",["woman-bowing"],34,40,15,0],
		"1f647-200d-2642-fe0f":[["\uD83D\uDE47\u200D\u2642\uFE0F","\uD83D\uDE47\u200D\u2642","\uD83D\uDE47"],"","",["man-bowing","bow"],34,46,15,0],
		"1f648":[["\uD83D\uDE48"],"","\uDBB8\uDF54",["see_no_evil"],34,58,15,0],
		"1f649":[["\uD83D\uDE49"],"","\uDBB8\uDF56",["hear_no_evil"],34,59,15,0],
		"1f64a":[["\uD83D\uDE4A"],"","\uDBB8\uDF55",["speak_no_evil"],35,0,15,0],
		"1f64b-200d-2640-fe0f":[["\uD83D\uDE4B\u200D\u2640\uFE0F","\uD83D\uDE4B\u200D\u2640","\uD83D\uDE4B"],"","",["woman-raising-hand","raising_hand"],35,1,15,0],
		"1f64b-200d-2642-fe0f":[["\uD83D\uDE4B\u200D\u2642\uFE0F","\uD83D\uDE4B\u200D\u2642"],"","",["man-raising-hand"],35,7,15,0],
		"1f64c":[["\uD83D\uDE4C"],"\uE427","\uDBB8\uDF58",["raised_hands"],35,19,15,0],
		"1f64d-200d-2640-fe0f":[["\uD83D\uDE4D\u200D\u2640\uFE0F","\uD83D\uDE4D\u200D\u2640","\uD83D\uDE4D"],"","",["woman-frowning","person_frowning"],35,25,15,0],
		"1f64d-200d-2642-fe0f":[["\uD83D\uDE4D\u200D\u2642\uFE0F","\uD83D\uDE4D\u200D\u2642"],"","",["man-frowning"],35,31,15,0],
		"1f64e-200d-2640-fe0f":[["\uD83D\uDE4E\u200D\u2640\uFE0F","\uD83D\uDE4E\u200D\u2640","\uD83D\uDE4E"],"","",["woman-pouting","person_with_pouting_face"],35,43,15,0],
		"1f64e-200d-2642-fe0f":[["\uD83D\uDE4E\u200D\u2642\uFE0F","\uD83D\uDE4E\u200D\u2642"],"","",["man-pouting"],35,49,15,0],
		"1f64f":[["\uD83D\uDE4F"],"\uE41D","\uDBB8\uDF5B",["pray"],36,1,15,0],
		"1f680":[["\uD83D\uDE80"],"\uE10D","\uDBB9\uDFED",["rocket"],36,7,15,0],
		"1f681":[["\uD83D\uDE81"],"","",["helicopter"],36,8,15,0],
		"1f682":[["\uD83D\uDE82"],"","",["steam_locomotive"],36,9,15,0],
		"1f683":[["\uD83D\uDE83"],"\uE01E","\uDBB9\uDFDF",["railway_car"],36,10,15,0],
		"1f684":[["\uD83D\uDE84"],"\uE435","\uDBB9\uDFE2",["bullettrain_side"],36,11,15,0],
		"1f685":[["\uD83D\uDE85"],"\uE01F","\uDBB9\uDFE3",["bullettrain_front"],36,12,15,0],
		"1f686":[["\uD83D\uDE86"],"","",["train2"],36,13,15,0],
		"1f687":[["\uD83D\uDE87"],"\uE434","\uDBB9\uDFE0",["metro"],36,14,15,0],
		"1f688":[["\uD83D\uDE88"],"","",["light_rail"],36,15,15,0],
		"1f689":[["\uD83D\uDE89"],"\uE039","\uDBB9\uDFEC",["station"],36,16,15,0],
		"1f68a":[["\uD83D\uDE8A"],"","",["tram"],36,17,15,0],
		"1f68b":[["\uD83D\uDE8B"],"","",["train"],36,18,15,0],
		"1f68c":[["\uD83D\uDE8C"],"\uE159","\uDBB9\uDFE6",["bus"],36,19,15,0],
		"1f68d":[["\uD83D\uDE8D"],"","",["oncoming_bus"],36,20,15,0],
		"1f68e":[["\uD83D\uDE8E"],"","",["trolleybus"],36,21,15,0],
		"1f68f":[["\uD83D\uDE8F"],"\uE150","\uDBB9\uDFE7",["busstop"],36,22,15,0],
		"1f690":[["\uD83D\uDE90"],"","",["minibus"],36,23,15,0],
		"1f691":[["\uD83D\uDE91"],"\uE431","\uDBB9\uDFF3",["ambulance"],36,24,15,0],
		"1f692":[["\uD83D\uDE92"],"\uE430","\uDBB9\uDFF2",["fire_engine"],36,25,15,0],
		"1f693":[["\uD83D\uDE93"],"\uE432","\uDBB9\uDFF4",["police_car"],36,26,15,0],
		"1f694":[["\uD83D\uDE94"],"","",["oncoming_police_car"],36,27,15,0],
		"1f695":[["\uD83D\uDE95"],"\uE15A","\uDBB9\uDFEF",["taxi"],36,28,15,0],
		"1f696":[["\uD83D\uDE96"],"","",["oncoming_taxi"],36,29,15,0],
		"1f697":[["\uD83D\uDE97"],"\uE01B","\uDBB9\uDFE4",["car","red_car"],36,30,15,0],
		"1f698":[["\uD83D\uDE98"],"","",["oncoming_automobile"],36,31,15,0],
		"1f699":[["\uD83D\uDE99"],"\uE42E","\uDBB9\uDFE5",["blue_car"],36,32,15,0],
		"1f69a":[["\uD83D\uDE9A"],"\uE42F","\uDBB9\uDFF1",["truck"],36,33,15,0],
		"1f69b":[["\uD83D\uDE9B"],"","",["articulated_lorry"],36,34,15,0],
		"1f69c":[["\uD83D\uDE9C"],"","",["tractor"],36,35,15,0],
		"1f69d":[["\uD83D\uDE9D"],"","",["monorail"],36,36,15,0],
		"1f69e":[["\uD83D\uDE9E"],"","",["mountain_railway"],36,37,15,0],
		"1f69f":[["\uD83D\uDE9F"],"","",["suspension_railway"],36,38,15,0],
		"1f6a0":[["\uD83D\uDEA0"],"","",["mountain_cableway"],36,39,15,0],
		"1f6a1":[["\uD83D\uDEA1"],"","",["aerial_tramway"],36,40,15,0],
		"1f6a2":[["\uD83D\uDEA2"],"\uE202","\uDBB9\uDFE8",["ship"],36,41,15,0],
		"1f6a3-200d-2640-fe0f":[["\uD83D\uDEA3\u200D\u2640\uFE0F","\uD83D\uDEA3\u200D\u2640"],"","",["woman-rowing-boat"],36,42,15,0],
		"1f6a3-200d-2642-fe0f":[["\uD83D\uDEA3\u200D\u2642\uFE0F","\uD83D\uDEA3\u200D\u2642","\uD83D\uDEA3"],"","",["man-rowing-boat","rowboat"],36,48,15,0],
		"1f6a4":[["\uD83D\uDEA4"],"\uE135","\uDBB9\uDFEE",["speedboat"],37,0,15,0],
		"1f6a5":[["\uD83D\uDEA5"],"\uE14E","\uDBB9\uDFF7",["traffic_light"],37,1,15,0],
		"1f6a6":[["\uD83D\uDEA6"],"","",["vertical_traffic_light"],37,2,15,0],
		"1f6a7":[["\uD83D\uDEA7"],"\uE137","\uDBB9\uDFF8",["construction"],37,3,15,0],
		"1f6a8":[["\uD83D\uDEA8"],"","\uDBB9\uDFF9",["rotating_light"],37,4,15,0],
		"1f6a9":[["\uD83D\uDEA9"],"","\uDBBA\uDF22",["triangular_flag_on_post"],37,5,15,0],
		"1f6aa":[["\uD83D\uDEAA"],"","\uDBB9\uDCF3",["door"],37,6,15,0],
		"1f6ab":[["\uD83D\uDEAB"],"","\uDBBA\uDF48",["no_entry_sign"],37,7,15,0],
		"1f6ac":[["\uD83D\uDEAC"],"\uE30E","\uDBBA\uDF1E",["smoking"],37,8,15,0],
		"1f6ad":[["\uD83D\uDEAD"],"\uE208","\uDBBA\uDF1F",["no_smoking"],37,9,15,0],
		"1f6ae":[["\uD83D\uDEAE"],"","",["put_litter_in_its_place"],37,10,15,0],
		"1f6af":[["\uD83D\uDEAF"],"","",["do_not_litter"],37,11,15,0],
		"1f6b0":[["\uD83D\uDEB0"],"","",["potable_water"],37,12,15,0],
		"1f6b1":[["\uD83D\uDEB1"],"","",["non-potable_water"],37,13,15,0],
		"1f6b2":[["\uD83D\uDEB2"],"\uE136","\uDBB9\uDFEB",["bike"],37,14,15,0],
		"1f6b3":[["\uD83D\uDEB3"],"","",["no_bicycles"],37,15,15,0],
		"1f6b4-200d-2640-fe0f":[["\uD83D\uDEB4\u200D\u2640\uFE0F","\uD83D\uDEB4\u200D\u2640"],"","",["woman-biking"],37,16,15,0],
		"1f6b4-200d-2642-fe0f":[["\uD83D\uDEB4\u200D\u2642\uFE0F","\uD83D\uDEB4\u200D\u2642","\uD83D\uDEB4"],"","",["man-biking","bicyclist"],37,22,15,0],
		"1f6b5-200d-2640-fe0f":[["\uD83D\uDEB5\u200D\u2640\uFE0F","\uD83D\uDEB5\u200D\u2640"],"","",["woman-mountain-biking"],37,34,15,0],
		"1f6b5-200d-2642-fe0f":[["\uD83D\uDEB5\u200D\u2642\uFE0F","\uD83D\uDEB5\u200D\u2642","\uD83D\uDEB5"],"","",["man-mountain-biking","mountain_bicyclist"],37,40,15,0],
		"1f6b6-200d-2640-fe0f":[["\uD83D\uDEB6\u200D\u2640\uFE0F","\uD83D\uDEB6\u200D\u2640"],"","",["woman-walking"],37,52,15,0],
		"1f6b6-200d-2642-fe0f":[["\uD83D\uDEB6\u200D\u2642\uFE0F","\uD83D\uDEB6\u200D\u2642","\uD83D\uDEB6"],"","",["man-walking","walking"],37,58,15,0],
		"1f6b7":[["\uD83D\uDEB7"],"","",["no_pedestrians"],38,10,15,0],
		"1f6b8":[["\uD83D\uDEB8"],"","",["children_crossing"],38,11,15,0],
		"1f6b9":[["\uD83D\uDEB9"],"\uE138","\uDBBA\uDF33",["mens"],38,12,15,0],
		"1f6ba":[["\uD83D\uDEBA"],"\uE139","\uDBBA\uDF34",["womens"],38,13,15,0],
		"1f6bb":[["\uD83D\uDEBB"],"\uE151","\uDBB9\uDD06",["restroom"],38,14,15,0],
		"1f6bc":[["\uD83D\uDEBC"],"\uE13A","\uDBBA\uDF35",["baby_symbol"],38,15,15,0],
		"1f6bd":[["\uD83D\uDEBD"],"\uE140","\uDBB9\uDD07",["toilet"],38,16,15,0],
		"1f6be":[["\uD83D\uDEBE"],"\uE309","\uDBB9\uDD08",["wc"],38,17,15,0],
		"1f6bf":[["\uD83D\uDEBF"],"","",["shower"],38,18,15,0],
		"1f6c0":[["\uD83D\uDEC0"],"\uE13F","\uDBB9\uDD05",["bath"],38,19,15,0],
		"1f6c1":[["\uD83D\uDEC1"],"","",["bathtub"],38,25,15,0],
		"1f6c2":[["\uD83D\uDEC2"],"","",["passport_control"],38,26,15,0],
		"1f6c3":[["\uD83D\uDEC3"],"","",["customs"],38,27,15,0],
		"1f6c4":[["\uD83D\uDEC4"],"","",["baggage_claim"],38,28,15,0],
		"1f6c5":[["\uD83D\uDEC5"],"","",["left_luggage"],38,29,15,0],
		"1f6cb-fe0f":[["\uD83D\uDECB\uFE0F","\uD83D\uDECB"],"","",["couch_and_lamp"],38,30,15,0],
		"1f6cc":[["\uD83D\uDECC"],"","",["sleeping_accommodation"],38,31,15,0],
		"1f6cd-fe0f":[["\uD83D\uDECD\uFE0F","\uD83D\uDECD"],"","",["shopping_bags"],38,37,15,0],
		"1f6ce-fe0f":[["\uD83D\uDECE\uFE0F","\uD83D\uDECE"],"","",["bellhop_bell"],38,38,15,0],
		"1f6cf-fe0f":[["\uD83D\uDECF\uFE0F","\uD83D\uDECF"],"","",["bed"],38,39,15,0],
		"1f6d0":[["\uD83D\uDED0"],"","",["place_of_worship"],38,40,15,0],
		"1f6d1":[["\uD83D\uDED1"],"","",["octagonal_sign"],38,41,15,0],
		"1f6d2":[["\uD83D\uDED2"],"","",["shopping_trolley"],38,42,15,0],
		"1f6d5":[["\uD83D\uDED5"],"","",["hindu_temple"],38,43,15,0],
		"1f6d6":[["\uD83D\uDED6"],"","",["hut"],38,44,15,0],
		"1f6d7":[["\uD83D\uDED7"],"","",["elevator"],38,45,15,0],
		"1f6e0-fe0f":[["\uD83D\uDEE0\uFE0F","\uD83D\uDEE0"],"","",["hammer_and_wrench"],38,46,15,0],
		"1f6e1-fe0f":[["\uD83D\uDEE1\uFE0F","\uD83D\uDEE1"],"","",["shield"],38,47,15,0],
		"1f6e2-fe0f":[["\uD83D\uDEE2\uFE0F","\uD83D\uDEE2"],"","",["oil_drum"],38,48,15,0],
		"1f6e3-fe0f":[["\uD83D\uDEE3\uFE0F","\uD83D\uDEE3"],"","",["motorway"],38,49,15,0],
		"1f6e4-fe0f":[["\uD83D\uDEE4\uFE0F","\uD83D\uDEE4"],"","",["railway_track"],38,50,15,0],
		"1f6e5-fe0f":[["\uD83D\uDEE5\uFE0F","\uD83D\uDEE5"],"","",["motor_boat"],38,51,15,0],
		"1f6e9-fe0f":[["\uD83D\uDEE9\uFE0F","\uD83D\uDEE9"],"","",["small_airplane"],38,52,15,0],
		"1f6eb":[["\uD83D\uDEEB"],"","",["airplane_departure"],38,53,15,0],
		"1f6ec":[["\uD83D\uDEEC"],"","",["airplane_arriving"],38,54,15,0],
		"1f6f0-fe0f":[["\uD83D\uDEF0\uFE0F","\uD83D\uDEF0"],"","",["satellite"],38,55,15,0],
		"1f6f3-fe0f":[["\uD83D\uDEF3\uFE0F","\uD83D\uDEF3"],"","",["passenger_ship"],38,56,15,0],
		"1f6f4":[["\uD83D\uDEF4"],"","",["scooter"],38,57,15,0],
		"1f6f5":[["\uD83D\uDEF5"],"","",["motor_scooter"],38,58,15,0],
		"1f6f6":[["\uD83D\uDEF6"],"","",["canoe"],38,59,15,0],
		"1f6f7":[["\uD83D\uDEF7"],"","",["sled"],39,0,15,0],
		"1f6f8":[["\uD83D\uDEF8"],"","",["flying_saucer"],39,1,15,0],
		"1f6f9":[["\uD83D\uDEF9"],"","",["skateboard"],39,2,15,0],
		"1f6fa":[["\uD83D\uDEFA"],"","",["auto_rickshaw"],39,3,15,0],
		"1f6fb":[["\uD83D\uDEFB"],"","",["pickup_truck"],39,4,15,0],
		"1f6fc":[["\uD83D\uDEFC"],"","",["roller_skate"],39,5,15,0],
		"1f7e0":[["\uD83D\uDFE0"],"","",["large_orange_circle"],39,6,15,0],
		"1f7e1":[["\uD83D\uDFE1"],"","",["large_yellow_circle"],39,7,15,0],
		"1f7e2":[["\uD83D\uDFE2"],"","",["large_green_circle"],39,8,15,0],
		"1f7e3":[["\uD83D\uDFE3"],"","",["large_purple_circle"],39,9,15,0],
		"1f7e4":[["\uD83D\uDFE4"],"","",["large_brown_circle"],39,10,15,0],
		"1f7e5":[["\uD83D\uDFE5"],"","",["large_red_square"],39,11,15,0],
		"1f7e6":[["\uD83D\uDFE6"],"","",["large_blue_square"],39,12,15,0],
		"1f7e7":[["\uD83D\uDFE7"],"","",["large_orange_square"],39,13,15,0],
		"1f7e8":[["\uD83D\uDFE8"],"","",["large_yellow_square"],39,14,15,0],
		"1f7e9":[["\uD83D\uDFE9"],"","",["large_green_square"],39,15,15,0],
		"1f7ea":[["\uD83D\uDFEA"],"","",["large_purple_square"],39,16,15,0],
		"1f7eb":[["\uD83D\uDFEB"],"","",["large_brown_square"],39,17,15,0],
		"1f90c":[["\uD83E\uDD0C"],"","",["pinched_fingers"],39,18,15,0],
		"1f90d":[["\uD83E\uDD0D"],"","",["white_heart"],39,24,15,0],
		"1f90e":[["\uD83E\uDD0E"],"","",["brown_heart"],39,25,15,0],
		"1f90f":[["\uD83E\uDD0F"],"","",["pinching_hand"],39,26,15,0],
		"1f910":[["\uD83E\uDD10"],"","",["zipper_mouth_face"],39,32,15,0],
		"1f911":[["\uD83E\uDD11"],"","",["money_mouth_face"],39,33,15,0],
		"1f912":[["\uD83E\uDD12"],"","",["face_with_thermometer"],39,34,15,0],
		"1f913":[["\uD83E\uDD13"],"","",["nerd_face"],39,35,15,0],
		"1f914":[["\uD83E\uDD14"],"","",["thinking_face"],39,36,15,0],
		"1f915":[["\uD83E\uDD15"],"","",["face_with_head_bandage"],39,37,15,0],
		"1f916":[["\uD83E\uDD16"],"","",["robot_face"],39,38,15,0],
		"1f917":[["\uD83E\uDD17"],"","",["hugging_face"],39,39,15,0],
		"1f918":[["\uD83E\uDD18"],"","",["the_horns","sign_of_the_horns"],39,40,15,0],
		"1f919":[["\uD83E\uDD19"],"","",["call_me_hand"],39,46,15,0],
		"1f91a":[["\uD83E\uDD1A"],"","",["raised_back_of_hand"],39,52,15,0],
		"1f91b":[["\uD83E\uDD1B"],"","",["left-facing_fist"],39,58,15,0],
		"1f91c":[["\uD83E\uDD1C"],"","",["right-facing_fist"],40,4,15,0],
		"1f91d":[["\uD83E\uDD1D"],"","",["handshake"],40,10,15,0],
		"1f91e":[["\uD83E\uDD1E"],"","",["crossed_fingers","hand_with_index_and_middle_fingers_crossed"],40,11,15,0],
		"1f91f":[["\uD83E\uDD1F"],"","",["i_love_you_hand_sign"],40,17,15,0],
		"1f920":[["\uD83E\uDD20"],"","",["face_with_cowboy_hat"],40,23,15,0],
		"1f921":[["\uD83E\uDD21"],"","",["clown_face"],40,24,15,0],
		"1f922":[["\uD83E\uDD22"],"","",["nauseated_face"],40,25,15,0],
		"1f923":[["\uD83E\uDD23"],"","",["rolling_on_the_floor_laughing"],40,26,15,0],
		"1f924":[["\uD83E\uDD24"],"","",["drooling_face"],40,27,15,0],
		"1f925":[["\uD83E\uDD25"],"","",["lying_face"],40,28,15,0],
		"1f926-200d-2640-fe0f":[["\uD83E\uDD26\u200D\u2640\uFE0F","\uD83E\uDD26\u200D\u2640"],"","",["woman-facepalming"],40,29,15,0],
		"1f926-200d-2642-fe0f":[["\uD83E\uDD26\u200D\u2642\uFE0F","\uD83E\uDD26\u200D\u2642"],"","",["man-facepalming"],40,35,15,0],
		"1f926":[["\uD83E\uDD26"],"","",["face_palm"],40,41,15,0],
		"1f927":[["\uD83E\uDD27"],"","",["sneezing_face"],40,47,15,0],
		"1f928":[["\uD83E\uDD28"],"","",["face_with_raised_eyebrow","face_with_one_eyebrow_raised"],40,48,15,0],
		"1f929":[["\uD83E\uDD29"],"","",["star-struck","grinning_face_with_star_eyes"],40,49,15,0],
		"1f92a":[["\uD83E\uDD2A"],"","",["zany_face","grinning_face_with_one_large_and_one_small_eye"],40,50,15,0],
		"1f92b":[["\uD83E\uDD2B"],"","",["shushing_face","face_with_finger_covering_closed_lips"],40,51,15,0],
		"1f92c":[["\uD83E\uDD2C"],"","",["face_with_symbols_on_mouth","serious_face_with_symbols_covering_mouth"],40,52,15,0],
		"1f92d":[["\uD83E\uDD2D"],"","",["face_with_hand_over_mouth","smiling_face_with_smiling_eyes_and_hand_covering_mouth"],40,53,15,0],
		"1f92e":[["\uD83E\uDD2E"],"","",["face_vomiting","face_with_open_mouth_vomiting"],40,54,15,0],
		"1f92f":[["\uD83E\uDD2F"],"","",["exploding_head","shocked_face_with_exploding_head"],40,55,15,0],
		"1f930":[["\uD83E\uDD30"],"","",["pregnant_woman"],40,56,15,0],
		"1f931":[["\uD83E\uDD31"],"","",["breast-feeding"],41,2,15,0],
		"1f932":[["\uD83E\uDD32"],"","",["palms_up_together"],41,8,15,0],
		"1f933":[["\uD83E\uDD33"],"","",["selfie"],41,14,15,0],
		"1f934":[["\uD83E\uDD34"],"","",["prince"],41,20,15,0],
		"1f935-200d-2640-fe0f":[["\uD83E\uDD35\u200D\u2640\uFE0F","\uD83E\uDD35\u200D\u2640"],"","",["woman_in_tuxedo"],41,26,15,0],
		"1f935-200d-2642-fe0f":[["\uD83E\uDD35\u200D\u2642\uFE0F","\uD83E\uDD35\u200D\u2642"],"","",["man_in_tuxedo"],41,32,15,0],
		"1f935":[["\uD83E\uDD35"],"","",["person_in_tuxedo"],41,38,15,0],
		"1f936":[["\uD83E\uDD36"],"","",["mrs_claus","mother_christmas"],41,44,15,0],
		"1f937-200d-2640-fe0f":[["\uD83E\uDD37\u200D\u2640\uFE0F","\uD83E\uDD37\u200D\u2640"],"","",["woman-shrugging"],41,50,15,0],
		"1f937-200d-2642-fe0f":[["\uD83E\uDD37\u200D\u2642\uFE0F","\uD83E\uDD37\u200D\u2642"],"","",["man-shrugging"],41,56,15,0],
		"1f937":[["\uD83E\uDD37"],"","",["shrug"],42,2,15,0],
		"1f938-200d-2640-fe0f":[["\uD83E\uDD38\u200D\u2640\uFE0F","\uD83E\uDD38\u200D\u2640"],"","",["woman-cartwheeling"],42,8,15,0],
		"1f938-200d-2642-fe0f":[["\uD83E\uDD38\u200D\u2642\uFE0F","\uD83E\uDD38\u200D\u2642"],"","",["man-cartwheeling"],42,14,15,0],
		"1f938":[["\uD83E\uDD38"],"","",["person_doing_cartwheel"],42,20,15,0],
		"1f939-200d-2640-fe0f":[["\uD83E\uDD39\u200D\u2640\uFE0F","\uD83E\uDD39\u200D\u2640"],"","",["woman-juggling"],42,26,15,0],
		"1f939-200d-2642-fe0f":[["\uD83E\uDD39\u200D\u2642\uFE0F","\uD83E\uDD39\u200D\u2642"],"","",["man-juggling"],42,32,15,0],
		"1f939":[["\uD83E\uDD39"],"","",["juggling"],42,38,15,0],
		"1f93a":[["\uD83E\uDD3A"],"","",["fencer"],42,44,15,0],
		"1f93c-200d-2640-fe0f":[["\uD83E\uDD3C\u200D\u2640\uFE0F","\uD83E\uDD3C\u200D\u2640"],"","",["woman-wrestling"],42,45,15,0],
		"1f93c-200d-2642-fe0f":[["\uD83E\uDD3C\u200D\u2642\uFE0F","\uD83E\uDD3C\u200D\u2642"],"","",["man-wrestling"],42,46,15,0],
		"1f93c":[["\uD83E\uDD3C"],"","",["wrestlers"],42,47,15,0],
		"1f93d-200d-2640-fe0f":[["\uD83E\uDD3D\u200D\u2640\uFE0F","\uD83E\uDD3D\u200D\u2640"],"","",["woman-playing-water-polo"],42,48,15,0],
		"1f93d-200d-2642-fe0f":[["\uD83E\uDD3D\u200D\u2642\uFE0F","\uD83E\uDD3D\u200D\u2642"],"","",["man-playing-water-polo"],42,54,15,0],
		"1f93d":[["\uD83E\uDD3D"],"","",["water_polo"],43,0,15,0],
		"1f93e-200d-2640-fe0f":[["\uD83E\uDD3E\u200D\u2640\uFE0F","\uD83E\uDD3E\u200D\u2640"],"","",["woman-playing-handball"],43,6,15,0],
		"1f93e-200d-2642-fe0f":[["\uD83E\uDD3E\u200D\u2642\uFE0F","\uD83E\uDD3E\u200D\u2642"],"","",["man-playing-handball"],43,12,15,0],
		"1f93e":[["\uD83E\uDD3E"],"","",["handball"],43,18,15,0],
		"1f93f":[["\uD83E\uDD3F"],"","",["diving_mask"],43,24,15,0],
		"1f940":[["\uD83E\uDD40"],"","",["wilted_flower"],43,25,15,0],
		"1f941":[["\uD83E\uDD41"],"","",["drum_with_drumsticks"],43,26,15,0],
		"1f942":[["\uD83E\uDD42"],"","",["clinking_glasses"],43,27,15,0],
		"1f943":[["\uD83E\uDD43"],"","",["tumbler_glass"],43,28,15,0],
		"1f944":[["\uD83E\uDD44"],"","",["spoon"],43,29,15,0],
		"1f945":[["\uD83E\uDD45"],"","",["goal_net"],43,30,15,0],
		"1f947":[["\uD83E\uDD47"],"","",["first_place_medal"],43,31,15,0],
		"1f948":[["\uD83E\uDD48"],"","",["second_place_medal"],43,32,15,0],
		"1f949":[["\uD83E\uDD49"],"","",["third_place_medal"],43,33,15,0],
		"1f94a":[["\uD83E\uDD4A"],"","",["boxing_glove"],43,34,15,0],
		"1f94b":[["\uD83E\uDD4B"],"","",["martial_arts_uniform"],43,35,15,0],
		"1f94c":[["\uD83E\uDD4C"],"","",["curling_stone"],43,36,15,0],
		"1f94d":[["\uD83E\uDD4D"],"","",["lacrosse"],43,37,15,0],
		"1f94e":[["\uD83E\uDD4E"],"","",["softball"],43,38,15,0],
		"1f94f":[["\uD83E\uDD4F"],"","",["flying_disc"],43,39,15,0],
		"1f950":[["\uD83E\uDD50"],"","",["croissant"],43,40,15,0],
		"1f951":[["\uD83E\uDD51"],"","",["avocado"],43,41,15,0],
		"1f952":[["\uD83E\uDD52"],"","",["cucumber"],43,42,15,0],
		"1f953":[["\uD83E\uDD53"],"","",["bacon"],43,43,15,0],
		"1f954":[["\uD83E\uDD54"],"","",["potato"],43,44,15,0],
		"1f955":[["\uD83E\uDD55"],"","",["carrot"],43,45,15,0],
		"1f956":[["\uD83E\uDD56"],"","",["baguette_bread"],43,46,15,0],
		"1f957":[["\uD83E\uDD57"],"","",["green_salad"],43,47,15,0],
		"1f958":[["\uD83E\uDD58"],"","",["shallow_pan_of_food"],43,48,15,0],
		"1f959":[["\uD83E\uDD59"],"","",["stuffed_flatbread"],43,49,15,0],
		"1f95a":[["\uD83E\uDD5A"],"","",["egg"],43,50,15,0],
		"1f95b":[["\uD83E\uDD5B"],"","",["glass_of_milk"],43,51,15,0],
		"1f95c":[["\uD83E\uDD5C"],"","",["peanuts"],43,52,15,0],
		"1f95d":[["\uD83E\uDD5D"],"","",["kiwifruit"],43,53,15,0],
		"1f95e":[["\uD83E\uDD5E"],"","",["pancakes"],43,54,15,0],
		"1f95f":[["\uD83E\uDD5F"],"","",["dumpling"],43,55,15,0],
		"1f960":[["\uD83E\uDD60"],"","",["fortune_cookie"],43,56,15,0],
		"1f961":[["\uD83E\uDD61"],"","",["takeout_box"],43,57,15,0],
		"1f962":[["\uD83E\uDD62"],"","",["chopsticks"],43,58,15,0],
		"1f963":[["\uD83E\uDD63"],"","",["bowl_with_spoon"],43,59,15,0],
		"1f964":[["\uD83E\uDD64"],"","",["cup_with_straw"],44,0,15,0],
		"1f965":[["\uD83E\uDD65"],"","",["coconut"],44,1,15,0],
		"1f966":[["\uD83E\uDD66"],"","",["broccoli"],44,2,15,0],
		"1f967":[["\uD83E\uDD67"],"","",["pie"],44,3,15,0],
		"1f968":[["\uD83E\uDD68"],"","",["pretzel"],44,4,15,0],
		"1f969":[["\uD83E\uDD69"],"","",["cut_of_meat"],44,5,15,0],
		"1f96a":[["\uD83E\uDD6A"],"","",["sandwich"],44,6,15,0],
		"1f96b":[["\uD83E\uDD6B"],"","",["canned_food"],44,7,15,0],
		"1f96c":[["\uD83E\uDD6C"],"","",["leafy_green"],44,8,15,0],
		"1f96d":[["\uD83E\uDD6D"],"","",["mango"],44,9,15,0],
		"1f96e":[["\uD83E\uDD6E"],"","",["moon_cake"],44,10,15,0],
		"1f96f":[["\uD83E\uDD6F"],"","",["bagel"],44,11,15,0],
		"1f970":[["\uD83E\uDD70"],"","",["smiling_face_with_3_hearts"],44,12,15,0],
		"1f971":[["\uD83E\uDD71"],"","",["yawning_face"],44,13,15,0],
		"1f972":[["\uD83E\uDD72"],"","",["smiling_face_with_tear"],44,14,15,0],
		"1f973":[["\uD83E\uDD73"],"","",["partying_face"],44,15,15,0],
		"1f974":[["\uD83E\uDD74"],"","",["woozy_face"],44,16,15,0],
		"1f975":[["\uD83E\uDD75"],"","",["hot_face"],44,17,15,0],
		"1f976":[["\uD83E\uDD76"],"","",["cold_face"],44,18,15,0],
		"1f977":[["\uD83E\uDD77"],"","",["ninja"],44,19,15,0],
		"1f978":[["\uD83E\uDD78"],"","",["disguised_face"],44,25,15,0],
		"1f97a":[["\uD83E\uDD7A"],"","",["pleading_face"],44,26,15,0],
		"1f97b":[["\uD83E\uDD7B"],"","",["sari"],44,27,15,0],
		"1f97c":[["\uD83E\uDD7C"],"","",["lab_coat"],44,28,15,0],
		"1f97d":[["\uD83E\uDD7D"],"","",["goggles"],44,29,15,0],
		"1f97e":[["\uD83E\uDD7E"],"","",["hiking_boot"],44,30,15,0],
		"1f97f":[["\uD83E\uDD7F"],"","",["womans_flat_shoe"],44,31,15,0],
		"1f980":[["\uD83E\uDD80"],"","",["crab"],44,32,15,0],
		"1f981":[["\uD83E\uDD81"],"","",["lion_face"],44,33,15,0],
		"1f982":[["\uD83E\uDD82"],"","",["scorpion"],44,34,15,0],
		"1f983":[["\uD83E\uDD83"],"","",["turkey"],44,35,15,0],
		"1f984":[["\uD83E\uDD84"],"","",["unicorn_face"],44,36,15,0],
		"1f985":[["\uD83E\uDD85"],"","",["eagle"],44,37,15,0],
		"1f986":[["\uD83E\uDD86"],"","",["duck"],44,38,15,0],
		"1f987":[["\uD83E\uDD87"],"","",["bat"],44,39,15,0],
		"1f988":[["\uD83E\uDD88"],"","",["shark"],44,40,15,0],
		"1f989":[["\uD83E\uDD89"],"","",["owl"],44,41,15,0],
		"1f98a":[["\uD83E\uDD8A"],"","",["fox_face"],44,42,15,0],
		"1f98b":[["\uD83E\uDD8B"],"","",["butterfly"],44,43,15,0],
		"1f98c":[["\uD83E\uDD8C"],"","",["deer"],44,44,15,0],
		"1f98d":[["\uD83E\uDD8D"],"","",["gorilla"],44,45,15,0],
		"1f98e":[["\uD83E\uDD8E"],"","",["lizard"],44,46,15,0],
		"1f98f":[["\uD83E\uDD8F"],"","",["rhinoceros"],44,47,15,0],
		"1f990":[["\uD83E\uDD90"],"","",["shrimp"],44,48,15,0],
		"1f991":[["\uD83E\uDD91"],"","",["squid"],44,49,15,0],
		"1f992":[["\uD83E\uDD92"],"","",["giraffe_face"],44,50,15,0],
		"1f993":[["\uD83E\uDD93"],"","",["zebra_face"],44,51,15,0],
		"1f994":[["\uD83E\uDD94"],"","",["hedgehog"],44,52,15,0],
		"1f995":[["\uD83E\uDD95"],"","",["sauropod"],44,53,15,0],
		"1f996":[["\uD83E\uDD96"],"","",["t-rex"],44,54,15,0],
		"1f997":[["\uD83E\uDD97"],"","",["cricket"],44,55,15,0],
		"1f998":[["\uD83E\uDD98"],"","",["kangaroo"],44,56,15,0],
		"1f999":[["\uD83E\uDD99"],"","",["llama"],44,57,15,0],
		"1f99a":[["\uD83E\uDD9A"],"","",["peacock"],44,58,15,0],
		"1f99b":[["\uD83E\uDD9B"],"","",["hippopotamus"],44,59,15,0],
		"1f99c":[["\uD83E\uDD9C"],"","",["parrot"],45,0,15,0],
		"1f99d":[["\uD83E\uDD9D"],"","",["raccoon"],45,1,15,0],
		"1f99e":[["\uD83E\uDD9E"],"","",["lobster"],45,2,15,0],
		"1f99f":[["\uD83E\uDD9F"],"","",["mosquito"],45,3,15,0],
		"1f9a0":[["\uD83E\uDDA0"],"","",["microbe"],45,4,15,0],
		"1f9a1":[["\uD83E\uDDA1"],"","",["badger"],45,5,15,0],
		"1f9a2":[["\uD83E\uDDA2"],"","",["swan"],45,6,15,0],
		"1f9a3":[["\uD83E\uDDA3"],"","",["mammoth"],45,7,15,0],
		"1f9a4":[["\uD83E\uDDA4"],"","",["dodo"],45,8,15,0],
		"1f9a5":[["\uD83E\uDDA5"],"","",["sloth"],45,9,15,0],
		"1f9a6":[["\uD83E\uDDA6"],"","",["otter"],45,10,15,0],
		"1f9a7":[["\uD83E\uDDA7"],"","",["orangutan"],45,11,15,0],
		"1f9a8":[["\uD83E\uDDA8"],"","",["skunk"],45,12,15,0],
		"1f9a9":[["\uD83E\uDDA9"],"","",["flamingo"],45,13,15,0],
		"1f9aa":[["\uD83E\uDDAA"],"","",["oyster"],45,14,15,0],
		"1f9ab":[["\uD83E\uDDAB"],"","",["beaver"],45,15,15,0],
		"1f9ac":[["\uD83E\uDDAC"],"","",["bison"],45,16,15,0],
		"1f9ad":[["\uD83E\uDDAD"],"","",["seal"],45,17,15,0],
		"1f9ae":[["\uD83E\uDDAE"],"","",["guide_dog"],45,18,15,0],
		"1f9af":[["\uD83E\uDDAF"],"","",["probing_cane"],45,19,15,0],
		"1f9b4":[["\uD83E\uDDB4"],"","",["bone"],45,20,15,0],
		"1f9b5":[["\uD83E\uDDB5"],"","",["leg"],45,21,15,0],
		"1f9b6":[["\uD83E\uDDB6"],"","",["foot"],45,27,15,0],
		"1f9b7":[["\uD83E\uDDB7"],"","",["tooth"],45,33,15,0],
		"1f9b8-200d-2640-fe0f":[["\uD83E\uDDB8\u200D\u2640\uFE0F","\uD83E\uDDB8\u200D\u2640"],"","",["female_superhero"],45,34,15,0],
		"1f9b8-200d-2642-fe0f":[["\uD83E\uDDB8\u200D\u2642\uFE0F","\uD83E\uDDB8\u200D\u2642"],"","",["male_superhero"],45,40,15,0],
		"1f9b8":[["\uD83E\uDDB8"],"","",["superhero"],45,46,15,0],
		"1f9b9-200d-2640-fe0f":[["\uD83E\uDDB9\u200D\u2640\uFE0F","\uD83E\uDDB9\u200D\u2640"],"","",["female_supervillain"],45,52,15,0],
		"1f9b9-200d-2642-fe0f":[["\uD83E\uDDB9\u200D\u2642\uFE0F","\uD83E\uDDB9\u200D\u2642"],"","",["male_supervillain"],45,58,15,0],
		"1f9b9":[["\uD83E\uDDB9"],"","",["supervillain"],46,4,15,0],
		"1f9ba":[["\uD83E\uDDBA"],"","",["safety_vest"],46,10,15,0],
		"1f9bb":[["\uD83E\uDDBB"],"","",["ear_with_hearing_aid"],46,11,15,0],
		"1f9bc":[["\uD83E\uDDBC"],"","",["motorized_wheelchair"],46,17,15,0],
		"1f9bd":[["\uD83E\uDDBD"],"","",["manual_wheelchair"],46,18,15,0],
		"1f9be":[["\uD83E\uDDBE"],"","",["mechanical_arm"],46,19,15,0],
		"1f9bf":[["\uD83E\uDDBF"],"","",["mechanical_leg"],46,20,15,0],
		"1f9c0":[["\uD83E\uDDC0"],"","",["cheese_wedge"],46,21,15,0],
		"1f9c1":[["\uD83E\uDDC1"],"","",["cupcake"],46,22,15,0],
		"1f9c2":[["\uD83E\uDDC2"],"","",["salt"],46,23,15,0],
		"1f9c3":[["\uD83E\uDDC3"],"","",["beverage_box"],46,24,15,0],
		"1f9c4":[["\uD83E\uDDC4"],"","",["garlic"],46,25,15,0],
		"1f9c5":[["\uD83E\uDDC5"],"","",["onion"],46,26,15,0],
		"1f9c6":[["\uD83E\uDDC6"],"","",["falafel"],46,27,15,0],
		"1f9c7":[["\uD83E\uDDC7"],"","",["waffle"],46,28,15,0],
		"1f9c8":[["\uD83E\uDDC8"],"","",["butter"],46,29,15,0],
		"1f9c9":[["\uD83E\uDDC9"],"","",["mate_drink"],46,30,15,0],
		"1f9ca":[["\uD83E\uDDCA"],"","",["ice_cube"],46,31,15,0],
		"1f9cb":[["\uD83E\uDDCB"],"","",["bubble_tea"],46,32,15,0],
		"1f9cd-200d-2640-fe0f":[["\uD83E\uDDCD\u200D\u2640\uFE0F","\uD83E\uDDCD\u200D\u2640"],"","",["woman_standing"],46,33,15,0],
		"1f9cd-200d-2642-fe0f":[["\uD83E\uDDCD\u200D\u2642\uFE0F","\uD83E\uDDCD\u200D\u2642"],"","",["man_standing"],46,39,15,0],
		"1f9cd":[["\uD83E\uDDCD"],"","",["standing_person"],46,45,15,0],
		"1f9ce-200d-2640-fe0f":[["\uD83E\uDDCE\u200D\u2640\uFE0F","\uD83E\uDDCE\u200D\u2640"],"","",["woman_kneeling"],46,51,15,0],
		"1f9ce-200d-2642-fe0f":[["\uD83E\uDDCE\u200D\u2642\uFE0F","\uD83E\uDDCE\u200D\u2642"],"","",["man_kneeling"],46,57,15,0],
		"1f9ce":[["\uD83E\uDDCE"],"","",["kneeling_person"],47,3,15,0],
		"1f9cf-200d-2640-fe0f":[["\uD83E\uDDCF\u200D\u2640\uFE0F","\uD83E\uDDCF\u200D\u2640"],"","",["deaf_woman"],47,9,15,0],
		"1f9cf-200d-2642-fe0f":[["\uD83E\uDDCF\u200D\u2642\uFE0F","\uD83E\uDDCF\u200D\u2642"],"","",["deaf_man"],47,15,15,0],
		"1f9cf":[["\uD83E\uDDCF"],"","",["deaf_person"],47,21,15,0],
		"1f9d0":[["\uD83E\uDDD0"],"","",["face_with_monocle"],47,27,15,0],
		"1f9d1-200d-1f33e":[["\uD83E\uDDD1\u200D\uD83C\uDF3E"],"","",["farmer"],47,28,15,0],
		"1f9d1-200d-1f373":[["\uD83E\uDDD1\u200D\uD83C\uDF73"],"","",["cook"],47,34,15,0],
		"1f9d1-200d-1f37c":[["\uD83E\uDDD1\u200D\uD83C\uDF7C"],"","",["person_feeding_baby"],47,40,15,0],
		"1f9d1-200d-1f384":[["\uD83E\uDDD1\u200D\uD83C\uDF84"],"","",["mx_claus"],47,46,15,0],
		"1f9d1-200d-1f393":[["\uD83E\uDDD1\u200D\uD83C\uDF93"],"","",["student"],47,52,15,0],
		"1f9d1-200d-1f3a4":[["\uD83E\uDDD1\u200D\uD83C\uDFA4"],"","",["singer"],47,58,15,0],
		"1f9d1-200d-1f3a8":[["\uD83E\uDDD1\u200D\uD83C\uDFA8"],"","",["artist"],48,4,15,0],
		"1f9d1-200d-1f3eb":[["\uD83E\uDDD1\u200D\uD83C\uDFEB"],"","",["teacher"],48,10,15,0],
		"1f9d1-200d-1f3ed":[["\uD83E\uDDD1\u200D\uD83C\uDFED"],"","",["factory_worker"],48,16,15,0],
		"1f9d1-200d-1f4bb":[["\uD83E\uDDD1\u200D\uD83D\uDCBB"],"","",["technologist"],48,22,15,0],
		"1f9d1-200d-1f4bc":[["\uD83E\uDDD1\u200D\uD83D\uDCBC"],"","",["office_worker"],48,28,15,0],
		"1f9d1-200d-1f527":[["\uD83E\uDDD1\u200D\uD83D\uDD27"],"","",["mechanic"],48,34,15,0],
		"1f9d1-200d-1f52c":[["\uD83E\uDDD1\u200D\uD83D\uDD2C"],"","",["scientist"],48,40,15,0],
		"1f9d1-200d-1f680":[["\uD83E\uDDD1\u200D\uD83D\uDE80"],"","",["astronaut"],48,46,15,0],
		"1f9d1-200d-1f692":[["\uD83E\uDDD1\u200D\uD83D\uDE92"],"","",["firefighter"],48,52,15,0],
		"1f9d1-200d-1f91d-200d-1f9d1":[["\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1"],"","",["people_holding_hands"],48,58,15,0],
		"1f9d1-200d-1f9af":[["\uD83E\uDDD1\u200D\uD83E\uDDAF"],"","",["person_with_probing_cane"],49,24,15,0],
		"1f9d1-200d-1f9b0":[["\uD83E\uDDD1\u200D\uD83E\uDDB0"],"","",["red_haired_person"],49,30,15,0],
		"1f9d1-200d-1f9b1":[["\uD83E\uDDD1\u200D\uD83E\uDDB1"],"","",["curly_haired_person"],49,36,15,0],
		"1f9d1-200d-1f9b2":[["\uD83E\uDDD1\u200D\uD83E\uDDB2"],"","",["bald_person"],49,42,7,0],
		"1f9d1-200d-1f9b3":[["\uD83E\uDDD1\u200D\uD83E\uDDB3"],"","",["white_haired_person"],49,48,7,0],
		"1f9d1-200d-1f9bc":[["\uD83E\uDDD1\u200D\uD83E\uDDBC"],"","",["person_in_motorized_wheelchair"],49,54,15,0],
		"1f9d1-200d-1f9bd":[["\uD83E\uDDD1\u200D\uD83E\uDDBD"],"","",["person_in_manual_wheelchair"],50,0,15,0],
		"1f9d1-200d-2695-fe0f":[["\uD83E\uDDD1\u200D\u2695\uFE0F","\uD83E\uDDD1\u200D\u2695"],"","",["health_worker"],50,6,15,0],
		"1f9d1-200d-2696-fe0f":[["\uD83E\uDDD1\u200D\u2696\uFE0F","\uD83E\uDDD1\u200D\u2696"],"","",["judge"],50,12,15,0],
		"1f9d1-200d-2708-fe0f":[["\uD83E\uDDD1\u200D\u2708\uFE0F","\uD83E\uDDD1\u200D\u2708"],"","",["pilot"],50,18,15,0],
		"1f9d1":[["\uD83E\uDDD1"],"","",["adult"],50,24,15,0],
		"1f9d2":[["\uD83E\uDDD2"],"","",["child"],50,30,15,0],
		"1f9d3":[["\uD83E\uDDD3"],"","",["older_adult"],50,36,15,0],
		"1f9d4-200d-2640-fe0f":[["\uD83E\uDDD4\u200D\u2640\uFE0F","\uD83E\uDDD4\u200D\u2640"],"","",["woman_with_beard"],50,42,7,0],
		"1f9d4-200d-2642-fe0f":[["\uD83E\uDDD4\u200D\u2642\uFE0F","\uD83E\uDDD4\u200D\u2642"],"","",["man_with_beard"],50,48,7,0],
		"1f9d4":[["\uD83E\uDDD4"],"","",["bearded_person"],50,54,15,0],
		"1f9d5":[["\uD83E\uDDD5"],"","",["person_with_headscarf"],51,0,15,0],
		"1f9d6-200d-2640-fe0f":[["\uD83E\uDDD6\u200D\u2640\uFE0F","\uD83E\uDDD6\u200D\u2640"],"","",["woman_in_steamy_room"],51,6,15,0],
		"1f9d6-200d-2642-fe0f":[["\uD83E\uDDD6\u200D\u2642\uFE0F","\uD83E\uDDD6\u200D\u2642","\uD83E\uDDD6"],"","",["man_in_steamy_room","person_in_steamy_room"],51,12,15,0],
		"1f9d7-200d-2640-fe0f":[["\uD83E\uDDD7\u200D\u2640\uFE0F","\uD83E\uDDD7\u200D\u2640","\uD83E\uDDD7"],"","",["woman_climbing","person_climbing"],51,24,15,0],
		"1f9d7-200d-2642-fe0f":[["\uD83E\uDDD7\u200D\u2642\uFE0F","\uD83E\uDDD7\u200D\u2642"],"","",["man_climbing"],51,30,15,0],
		"1f9d8-200d-2640-fe0f":[["\uD83E\uDDD8\u200D\u2640\uFE0F","\uD83E\uDDD8\u200D\u2640","\uD83E\uDDD8"],"","",["woman_in_lotus_position","person_in_lotus_position"],51,42,15,0],
		"1f9d8-200d-2642-fe0f":[["\uD83E\uDDD8\u200D\u2642\uFE0F","\uD83E\uDDD8\u200D\u2642"],"","",["man_in_lotus_position"],51,48,15,0],
		"1f9d9-200d-2640-fe0f":[["\uD83E\uDDD9\u200D\u2640\uFE0F","\uD83E\uDDD9\u200D\u2640","\uD83E\uDDD9"],"","",["female_mage","mage"],52,0,15,0],
		"1f9d9-200d-2642-fe0f":[["\uD83E\uDDD9\u200D\u2642\uFE0F","\uD83E\uDDD9\u200D\u2642"],"","",["male_mage"],52,6,15,0],
		"1f9da-200d-2640-fe0f":[["\uD83E\uDDDA\u200D\u2640\uFE0F","\uD83E\uDDDA\u200D\u2640","\uD83E\uDDDA"],"","",["female_fairy","fairy"],52,18,15,0],
		"1f9da-200d-2642-fe0f":[["\uD83E\uDDDA\u200D\u2642\uFE0F","\uD83E\uDDDA\u200D\u2642"],"","",["male_fairy"],52,24,15,0],
		"1f9db-200d-2640-fe0f":[["\uD83E\uDDDB\u200D\u2640\uFE0F","\uD83E\uDDDB\u200D\u2640","\uD83E\uDDDB"],"","",["female_vampire","vampire"],52,36,15,0],
		"1f9db-200d-2642-fe0f":[["\uD83E\uDDDB\u200D\u2642\uFE0F","\uD83E\uDDDB\u200D\u2642"],"","",["male_vampire"],52,42,15,0],
		"1f9dc-200d-2640-fe0f":[["\uD83E\uDDDC\u200D\u2640\uFE0F","\uD83E\uDDDC\u200D\u2640"],"","",["mermaid"],52,54,15,0],
		"1f9dc-200d-2642-fe0f":[["\uD83E\uDDDC\u200D\u2642\uFE0F","\uD83E\uDDDC\u200D\u2642","\uD83E\uDDDC"],"","",["merman","merperson"],53,0,15,0],
		"1f9dd-200d-2640-fe0f":[["\uD83E\uDDDD\u200D\u2640\uFE0F","\uD83E\uDDDD\u200D\u2640"],"","",["female_elf"],53,12,15,0],
		"1f9dd-200d-2642-fe0f":[["\uD83E\uDDDD\u200D\u2642\uFE0F","\uD83E\uDDDD\u200D\u2642","\uD83E\uDDDD"],"","",["male_elf","elf"],53,18,15,0],
		"1f9de-200d-2640-fe0f":[["\uD83E\uDDDE\u200D\u2640\uFE0F","\uD83E\uDDDE\u200D\u2640"],"","",["female_genie"],53,30,15,0],
		"1f9de-200d-2642-fe0f":[["\uD83E\uDDDE\u200D\u2642\uFE0F","\uD83E\uDDDE\u200D\u2642","\uD83E\uDDDE"],"","",["male_genie","genie"],53,31,15,0],
		"1f9df-200d-2640-fe0f":[["\uD83E\uDDDF\u200D\u2640\uFE0F","\uD83E\uDDDF\u200D\u2640"],"","",["female_zombie"],53,33,15,0],
		"1f9df-200d-2642-fe0f":[["\uD83E\uDDDF\u200D\u2642\uFE0F","\uD83E\uDDDF\u200D\u2642","\uD83E\uDDDF"],"","",["male_zombie","zombie"],53,34,15,0],
		"1f9e0":[["\uD83E\uDDE0"],"","",["brain"],53,36,15,0],
		"1f9e1":[["\uD83E\uDDE1"],"","",["orange_heart"],53,37,15,0],
		"1f9e2":[["\uD83E\uDDE2"],"","",["billed_cap"],53,38,15,0],
		"1f9e3":[["\uD83E\uDDE3"],"","",["scarf"],53,39,15,0],
		"1f9e4":[["\uD83E\uDDE4"],"","",["gloves"],53,40,15,0],
		"1f9e5":[["\uD83E\uDDE5"],"","",["coat"],53,41,15,0],
		"1f9e6":[["\uD83E\uDDE6"],"","",["socks"],53,42,15,0],
		"1f9e7":[["\uD83E\uDDE7"],"","",["red_envelope"],53,43,15,0],
		"1f9e8":[["\uD83E\uDDE8"],"","",["firecracker"],53,44,15,0],
		"1f9e9":[["\uD83E\uDDE9"],"","",["jigsaw"],53,45,15,0],
		"1f9ea":[["\uD83E\uDDEA"],"","",["test_tube"],53,46,15,0],
		"1f9eb":[["\uD83E\uDDEB"],"","",["petri_dish"],53,47,15,0],
		"1f9ec":[["\uD83E\uDDEC"],"","",["dna"],53,48,15,0],
		"1f9ed":[["\uD83E\uDDED"],"","",["compass"],53,49,15,0],
		"1f9ee":[["\uD83E\uDDEE"],"","",["abacus"],53,50,15,0],
		"1f9ef":[["\uD83E\uDDEF"],"","",["fire_extinguisher"],53,51,15,0],
		"1f9f0":[["\uD83E\uDDF0"],"","",["toolbox"],53,52,15,0],
		"1f9f1":[["\uD83E\uDDF1"],"","",["bricks"],53,53,15,0],
		"1f9f2":[["\uD83E\uDDF2"],"","",["magnet"],53,54,15,0],
		"1f9f3":[["\uD83E\uDDF3"],"","",["luggage"],53,55,15,0],
		"1f9f4":[["\uD83E\uDDF4"],"","",["lotion_bottle"],53,56,15,0],
		"1f9f5":[["\uD83E\uDDF5"],"","",["thread"],53,57,15,0],
		"1f9f6":[["\uD83E\uDDF6"],"","",["yarn"],53,58,15,0],
		"1f9f7":[["\uD83E\uDDF7"],"","",["safety_pin"],53,59,15,0],
		"1f9f8":[["\uD83E\uDDF8"],"","",["teddy_bear"],54,0,15,0],
		"1f9f9":[["\uD83E\uDDF9"],"","",["broom"],54,1,15,0],
		"1f9fa":[["\uD83E\uDDFA"],"","",["basket"],54,2,15,0],
		"1f9fb":[["\uD83E\uDDFB"],"","",["roll_of_paper"],54,3,15,0],
		"1f9fc":[["\uD83E\uDDFC"],"","",["soap"],54,4,15,0],
		"1f9fd":[["\uD83E\uDDFD"],"","",["sponge"],54,5,15,0],
		"1f9fe":[["\uD83E\uDDFE"],"","",["receipt"],54,6,15,0],
		"1f9ff":[["\uD83E\uDDFF"],"","",["nazar_amulet"],54,7,15,0],
		"1fa70":[["\uD83E\uDE70"],"","",["ballet_shoes"],54,8,15,0],
		"1fa71":[["\uD83E\uDE71"],"","",["one-piece_swimsuit"],54,9,15,0],
		"1fa72":[["\uD83E\uDE72"],"","",["briefs"],54,10,15,0],
		"1fa73":[["\uD83E\uDE73"],"","",["shorts"],54,11,15,0],
		"1fa74":[["\uD83E\uDE74"],"","",["thong_sandal"],54,12,15,0],
		"1fa78":[["\uD83E\uDE78"],"","",["drop_of_blood"],54,13,15,0],
		"1fa79":[["\uD83E\uDE79"],"","",["adhesive_bandage"],54,14,15,0],
		"1fa7a":[["\uD83E\uDE7A"],"","",["stethoscope"],54,15,15,0],
		"1fa80":[["\uD83E\uDE80"],"","",["yo-yo"],54,16,15,0],
		"1fa81":[["\uD83E\uDE81"],"","",["kite"],54,17,15,0],
		"1fa82":[["\uD83E\uDE82"],"","",["parachute"],54,18,15,0],
		"1fa83":[["\uD83E\uDE83"],"","",["boomerang"],54,19,15,0],
		"1fa84":[["\uD83E\uDE84"],"","",["magic_wand"],54,20,15,0],
		"1fa85":[["\uD83E\uDE85"],"","",["pinata"],54,21,15,0],
		"1fa86":[["\uD83E\uDE86"],"","",["nesting_dolls"],54,22,15,0],
		"1fa90":[["\uD83E\uDE90"],"","",["ringed_planet"],54,23,15,0],
		"1fa91":[["\uD83E\uDE91"],"","",["chair"],54,24,15,0],
		"1fa92":[["\uD83E\uDE92"],"","",["razor"],54,25,15,0],
		"1fa93":[["\uD83E\uDE93"],"","",["axe"],54,26,15,0],
		"1fa94":[["\uD83E\uDE94"],"","",["diya_lamp"],54,27,15,0],
		"1fa95":[["\uD83E\uDE95"],"","",["banjo"],54,28,15,0],
		"1fa96":[["\uD83E\uDE96"],"","",["military_helmet"],54,29,15,0],
		"1fa97":[["\uD83E\uDE97"],"","",["accordion"],54,30,15,0],
		"1fa98":[["\uD83E\uDE98"],"","",["long_drum"],54,31,15,0],
		"1fa99":[["\uD83E\uDE99"],"","",["coin"],54,32,15,0],
		"1fa9a":[["\uD83E\uDE9A"],"","",["carpentry_saw"],54,33,15,0],
		"1fa9b":[["\uD83E\uDE9B"],"","",["screwdriver"],54,34,15,0],
		"1fa9c":[["\uD83E\uDE9C"],"","",["ladder"],54,35,15,0],
		"1fa9d":[["\uD83E\uDE9D"],"","",["hook"],54,36,15,0],
		"1fa9e":[["\uD83E\uDE9E"],"","",["mirror"],54,37,15,0],
		"1fa9f":[["\uD83E\uDE9F"],"","",["window"],54,38,15,0],
		"1faa0":[["\uD83E\uDEA0"],"","",["plunger"],54,39,15,0],
		"1faa1":[["\uD83E\uDEA1"],"","",["sewing_needle"],54,40,15,0],
		"1faa2":[["\uD83E\uDEA2"],"","",["knot"],54,41,15,0],
		"1faa3":[["\uD83E\uDEA3"],"","",["bucket"],54,42,15,0],
		"1faa4":[["\uD83E\uDEA4"],"","",["mouse_trap"],54,43,15,0],
		"1faa5":[["\uD83E\uDEA5"],"","",["toothbrush"],54,44,15,0],
		"1faa6":[["\uD83E\uDEA6"],"","",["headstone"],54,45,15,0],
		"1faa7":[["\uD83E\uDEA7"],"","",["placard"],54,46,15,0],
		"1faa8":[["\uD83E\uDEA8"],"","",["rock"],54,47,15,0],
		"1fab0":[["\uD83E\uDEB0"],"","",["fly"],54,48,15,0],
		"1fab1":[["\uD83E\uDEB1"],"","",["worm"],54,49,15,0],
		"1fab2":[["\uD83E\uDEB2"],"","",["beetle"],54,50,15,0],
		"1fab3":[["\uD83E\uDEB3"],"","",["cockroach"],54,51,15,0],
		"1fab4":[["\uD83E\uDEB4"],"","",["potted_plant"],54,52,15,0],
		"1fab5":[["\uD83E\uDEB5"],"","",["wood"],54,53,15,0],
		"1fab6":[["\uD83E\uDEB6"],"","",["feather"],54,54,15,0],
		"1fac0":[["\uD83E\uDEC0"],"","",["anatomical_heart"],54,55,15,0],
		"1fac1":[["\uD83E\uDEC1"],"","",["lungs"],54,56,15,0],
		"1fac2":[["\uD83E\uDEC2"],"","",["people_hugging"],54,57,15,0],
		"1fad0":[["\uD83E\uDED0"],"","",["blueberries"],54,58,15,0],
		"1fad1":[["\uD83E\uDED1"],"","",["bell_pepper"],54,59,15,0],
		"1fad2":[["\uD83E\uDED2"],"","",["olive"],55,0,15,0],
		"1fad3":[["\uD83E\uDED3"],"","",["flatbread"],55,1,15,0],
		"1fad4":[["\uD83E\uDED4"],"","",["tamale"],55,2,15,0],
		"1fad5":[["\uD83E\uDED5"],"","",["fondue"],55,3,15,0],
		"1fad6":[["\uD83E\uDED6"],"","",["teapot"],55,4,15,0],
		"203c-fe0f":[["\u203C\uFE0F","\u203C"],"","\uDBBA\uDF06",["bangbang"],55,5,15,0],
		"2049-fe0f":[["\u2049\uFE0F","\u2049"],"","\uDBBA\uDF05",["interrobang"],55,6,15,0],
		"2122-fe0f":[["\u2122\uFE0F","\u2122"],"\uE537","\uDBBA\uDF2A",["tm"],55,7,15,0],
		"2139-fe0f":[["\u2139\uFE0F","\u2139"],"","\uDBBA\uDF47",["information_source"],55,8,15,0],
		"2194-fe0f":[["\u2194\uFE0F","\u2194"],"","\uDBBA\uDEF6",["left_right_arrow"],55,9,15,0],
		"2195-fe0f":[["\u2195\uFE0F","\u2195"],"","\uDBBA\uDEF7",["arrow_up_down"],55,10,15,0],
		"2196-fe0f":[["\u2196\uFE0F","\u2196"],"\uE237","\uDBBA\uDEF2",["arrow_upper_left"],55,11,15,0],
		"2197-fe0f":[["\u2197\uFE0F","\u2197"],"\uE236","\uDBBA\uDEF0",["arrow_upper_right"],55,12,15,0],
		"2198-fe0f":[["\u2198\uFE0F","\u2198"],"\uE238","\uDBBA\uDEF1",["arrow_lower_right"],55,13,15,0],
		"2199-fe0f":[["\u2199\uFE0F","\u2199"],"\uE239","\uDBBA\uDEF3",["arrow_lower_left"],55,14,15,0],
		"21a9-fe0f":[["\u21A9\uFE0F","\u21A9"],"","\uDBBA\uDF83",["leftwards_arrow_with_hook"],55,15,15,0],
		"21aa-fe0f":[["\u21AA\uFE0F","\u21AA"],"","\uDBBA\uDF88",["arrow_right_hook"],55,16,15,0],
		"231a":[["\u231A"],"","\uDBB8\uDC1D",["watch"],55,17,15,0],
		"231b":[["\u231B"],"","\uDBB8\uDC1C",["hourglass"],55,18,15,0],
		"2328-fe0f":[["\u2328\uFE0F","\u2328"],"","",["keyboard"],55,19,15,0],
		"23cf-fe0f":[["\u23CF\uFE0F","\u23CF"],"","",["eject"],55,20,15,0],
		"23e9":[["\u23E9"],"\uE23C","\uDBBA\uDEFE",["fast_forward"],55,21,15,0],
		"23ea":[["\u23EA"],"\uE23D","\uDBBA\uDEFF",["rewind"],55,22,15,0],
		"23eb":[["\u23EB"],"","\uDBBA\uDF03",["arrow_double_up"],55,23,15,0],
		"23ec":[["\u23EC"],"","\uDBBA\uDF02",["arrow_double_down"],55,24,15,0],
		"23ed-fe0f":[["\u23ED\uFE0F","\u23ED"],"","",["black_right_pointing_double_triangle_with_vertical_bar"],55,25,15,0],
		"23ee-fe0f":[["\u23EE\uFE0F","\u23EE"],"","",["black_left_pointing_double_triangle_with_vertical_bar"],55,26,15,0],
		"23ef-fe0f":[["\u23EF\uFE0F","\u23EF"],"","",["black_right_pointing_triangle_with_double_vertical_bar"],55,27,15,0],
		"23f0":[["\u23F0"],"","\uDBB8\uDC2A",["alarm_clock"],55,28,15,0],
		"23f1-fe0f":[["\u23F1\uFE0F","\u23F1"],"","",["stopwatch"],55,29,15,0],
		"23f2-fe0f":[["\u23F2\uFE0F","\u23F2"],"","",["timer_clock"],55,30,15,0],
		"23f3":[["\u23F3"],"","\uDBB8\uDC1B",["hourglass_flowing_sand"],55,31,15,0],
		"23f8-fe0f":[["\u23F8\uFE0F","\u23F8"],"","",["double_vertical_bar"],55,32,15,0],
		"23f9-fe0f":[["\u23F9\uFE0F","\u23F9"],"","",["black_square_for_stop"],55,33,15,0],
		"23fa-fe0f":[["\u23FA\uFE0F","\u23FA"],"","",["black_circle_for_record"],55,34,15,0],
		"24c2-fe0f":[["\u24C2\uFE0F","\u24C2"],"","\uDBB9\uDFE1",["m"],55,35,15,0],
		"25aa-fe0f":[["\u25AA\uFE0F","\u25AA"],"","\uDBBA\uDF6E",["black_small_square"],55,36,15,0],
		"25ab-fe0f":[["\u25AB\uFE0F","\u25AB"],"","\uDBBA\uDF6D",["white_small_square"],55,37,15,0],
		"25b6-fe0f":[["\u25B6\uFE0F","\u25B6"],"\uE23A","\uDBBA\uDEFC",["arrow_forward"],55,38,15,0],
		"25c0-fe0f":[["\u25C0\uFE0F","\u25C0"],"\uE23B","\uDBBA\uDEFD",["arrow_backward"],55,39,15,0],
		"25fb-fe0f":[["\u25FB\uFE0F","\u25FB"],"","\uDBBA\uDF71",["white_medium_square"],55,40,15,0],
		"25fc-fe0f":[["\u25FC\uFE0F","\u25FC"],"","\uDBBA\uDF72",["black_medium_square"],55,41,15,0],
		"25fd":[["\u25FD"],"","\uDBBA\uDF6F",["white_medium_small_square"],55,42,15,0],
		"25fe":[["\u25FE"],"","\uDBBA\uDF70",["black_medium_small_square"],55,43,15,0],
		"2600-fe0f":[["\u2600\uFE0F","\u2600"],"\uE04A","\uDBB8\uDC00",["sunny"],55,44,15,0],
		"2601-fe0f":[["\u2601\uFE0F","\u2601"],"\uE049","\uDBB8\uDC01",["cloud"],55,45,15,0],
		"2602-fe0f":[["\u2602\uFE0F","\u2602"],"","",["umbrella"],55,46,15,0],
		"2603-fe0f":[["\u2603\uFE0F","\u2603"],"","",["snowman"],55,47,15,0],
		"2604-fe0f":[["\u2604\uFE0F","\u2604"],"","",["comet"],55,48,15,0],
		"260e-fe0f":[["\u260E\uFE0F","\u260E"],"\uE009","\uDBB9\uDD23",["phone","telephone"],55,49,15,0],
		"2611-fe0f":[["\u2611\uFE0F","\u2611"],"","\uDBBA\uDF8B",["ballot_box_with_check"],55,50,15,0],
		"2614":[["\u2614"],"\uE04B","\uDBB8\uDC02",["umbrella_with_rain_drops"],55,51,15,0],
		"2615":[["\u2615"],"\uE045","\uDBBA\uDD81",["coffee"],55,52,15,0],
		"2618-fe0f":[["\u2618\uFE0F","\u2618"],"","",["shamrock"],55,53,15,0],
		"261d-fe0f":[["\u261D\uFE0F","\u261D"],"\uE00F","\uDBBA\uDF98",["point_up"],55,54,15,0],
		"2620-fe0f":[["\u2620\uFE0F","\u2620"],"","",["skull_and_crossbones"],56,0,15,0],
		"2622-fe0f":[["\u2622\uFE0F","\u2622"],"","",["radioactive_sign"],56,1,15,0],
		"2623-fe0f":[["\u2623\uFE0F","\u2623"],"","",["biohazard_sign"],56,2,15,0],
		"2626-fe0f":[["\u2626\uFE0F","\u2626"],"","",["orthodox_cross"],56,3,15,0],
		"262a-fe0f":[["\u262A\uFE0F","\u262A"],"","",["star_and_crescent"],56,4,15,0],
		"262e-fe0f":[["\u262E\uFE0F","\u262E"],"","",["peace_symbol"],56,5,15,0],
		"262f-fe0f":[["\u262F\uFE0F","\u262F"],"","",["yin_yang"],56,6,15,0],
		"2638-fe0f":[["\u2638\uFE0F","\u2638"],"","",["wheel_of_dharma"],56,7,15,0],
		"2639-fe0f":[["\u2639\uFE0F","\u2639"],"","",["white_frowning_face"],56,8,15,0],
		"263a-fe0f":[["\u263A\uFE0F","\u263A"],"\uE414","\uDBB8\uDF36",["relaxed"],56,9,15,0],
		"2640-fe0f":[["\u2640\uFE0F","\u2640"],"","",["female_sign"],56,10,14,0],
		"2642-fe0f":[["\u2642\uFE0F","\u2642"],"","",["male_sign"],56,11,14,0],
		"2648":[["\u2648"],"\uE23F","\uDBB8\uDC2B",["aries"],56,12,15,0],
		"2649":[["\u2649"],"\uE240","\uDBB8\uDC2C",["taurus"],56,13,15,0],
		"264a":[["\u264A"],"\uE241","\uDBB8\uDC2D",["gemini"],56,14,15,0],
		"264b":[["\u264B"],"\uE242","\uDBB8\uDC2E",["cancer"],56,15,15,0],
		"264c":[["\u264C"],"\uE243","\uDBB8\uDC2F",["leo"],56,16,15,0],
		"264d":[["\u264D"],"\uE244","\uDBB8\uDC30",["virgo"],56,17,15,0],
		"264e":[["\u264E"],"\uE245","\uDBB8\uDC31",["libra"],56,18,15,0],
		"264f":[["\u264F"],"\uE246","\uDBB8\uDC32",["scorpius"],56,19,15,0],
		"2650":[["\u2650"],"\uE247","\uDBB8\uDC33",["sagittarius"],56,20,15,0],
		"2651":[["\u2651"],"\uE248","\uDBB8\uDC34",["capricorn"],56,21,15,0],
		"2652":[["\u2652"],"\uE249","\uDBB8\uDC35",["aquarius"],56,22,15,0],
		"2653":[["\u2653"],"\uE24A","\uDBB8\uDC36",["pisces"],56,23,15,0],
		"265f-fe0f":[["\u265F\uFE0F","\u265F"],"","",["chess_pawn"],56,24,15,0],
		"2660-fe0f":[["\u2660\uFE0F","\u2660"],"\uE20E","\uDBBA\uDF1B",["spades"],56,25,15,0],
		"2663-fe0f":[["\u2663\uFE0F","\u2663"],"\uE20F","\uDBBA\uDF1D",["clubs"],56,26,15,0],
		"2665-fe0f":[["\u2665\uFE0F","\u2665"],"\uE20C","\uDBBA\uDF1A",["hearts"],56,27,15,0],
		"2666-fe0f":[["\u2666\uFE0F","\u2666"],"\uE20D","\uDBBA\uDF1C",["diamonds"],56,28,15,0],
		"2668-fe0f":[["\u2668\uFE0F","\u2668"],"\uE123","\uDBB9\uDFFA",["hotsprings"],56,29,15,0],
		"267b-fe0f":[["\u267B\uFE0F","\u267B"],"","\uDBBA\uDF2C",["recycle"],56,30,15,0],
		"267e-fe0f":[["\u267E\uFE0F","\u267E"],"","",["infinity"],56,31,15,0],
		"267f":[["\u267F"],"\uE20A","\uDBBA\uDF20",["wheelchair"],56,32,15,0],
		"2692-fe0f":[["\u2692\uFE0F","\u2692"],"","",["hammer_and_pick"],56,33,15,0],
		"2693":[["\u2693"],"","\uDBB9\uDCC1",["anchor"],56,34,15,0],
		"2694-fe0f":[["\u2694\uFE0F","\u2694"],"","",["crossed_swords"],56,35,15,0],
		"2695-fe0f":[["\u2695\uFE0F","\u2695"],"","",["medical_symbol","staff_of_aesculapius"],56,36,14,0],
		"2696-fe0f":[["\u2696\uFE0F","\u2696"],"","",["scales"],56,37,15,0],
		"2697-fe0f":[["\u2697\uFE0F","\u2697"],"","",["alembic"],56,38,15,0],
		"2699-fe0f":[["\u2699\uFE0F","\u2699"],"","",["gear"],56,39,15,0],
		"269b-fe0f":[["\u269B\uFE0F","\u269B"],"","",["atom_symbol"],56,40,15,0],
		"269c-fe0f":[["\u269C\uFE0F","\u269C"],"","",["fleur_de_lis"],56,41,15,0],
		"26a0-fe0f":[["\u26A0\uFE0F","\u26A0"],"\uE252","\uDBBA\uDF23",["warning"],56,42,15,0],
		"26a1":[["\u26A1"],"\uE13D","\uDBB8\uDC04",["zap"],56,43,15,0],
		"26a7-fe0f":[["\u26A7\uFE0F","\u26A7"],"","",["transgender_symbol"],56,44,15,0],
		"26aa":[["\u26AA"],"","\uDBBA\uDF65",["white_circle"],56,45,15,0],
		"26ab":[["\u26AB"],"","\uDBBA\uDF66",["black_circle"],56,46,15,0],
		"26b0-fe0f":[["\u26B0\uFE0F","\u26B0"],"","",["coffin"],56,47,15,0],
		"26b1-fe0f":[["\u26B1\uFE0F","\u26B1"],"","",["funeral_urn"],56,48,15,0],
		"26bd":[["\u26BD"],"\uE018","\uDBB9\uDFD4",["soccer"],56,49,15,0],
		"26be":[["\u26BE"],"\uE016","\uDBB9\uDFD1",["baseball"],56,50,15,0],
		"26c4":[["\u26C4"],"\uE048","\uDBB8\uDC03",["snowman_without_snow"],56,51,15,0],
		"26c5":[["\u26C5"],"","\uDBB8\uDC0F",["partly_sunny"],56,52,15,0],
		"26c8-fe0f":[["\u26C8\uFE0F","\u26C8"],"","",["thunder_cloud_and_rain"],56,53,15,0],
		"26ce":[["\u26CE"],"\uE24B","\uDBB8\uDC37",["ophiuchus"],56,54,15,0],
		"26cf-fe0f":[["\u26CF\uFE0F","\u26CF"],"","",["pick"],56,55,15,0],
		"26d1-fe0f":[["\u26D1\uFE0F","\u26D1"],"","",["helmet_with_white_cross"],56,56,15,0],
		"26d3-fe0f":[["\u26D3\uFE0F","\u26D3"],"","",["chains"],56,57,15,0],
		"26d4":[["\u26D4"],"","\uDBBA\uDF26",["no_entry"],56,58,15,0],
		"26e9-fe0f":[["\u26E9\uFE0F","\u26E9"],"","",["shinto_shrine"],56,59,15,0],
		"26ea":[["\u26EA"],"\uE037","\uDBB9\uDCBB",["church"],57,0,15,0],
		"26f0-fe0f":[["\u26F0\uFE0F","\u26F0"],"","",["mountain"],57,1,15,0],
		"26f1-fe0f":[["\u26F1\uFE0F","\u26F1"],"","",["umbrella_on_ground"],57,2,15,0],
		"26f2":[["\u26F2"],"\uE121","\uDBB9\uDCBC",["fountain"],57,3,15,0],
		"26f3":[["\u26F3"],"\uE014","\uDBB9\uDFD2",["golf"],57,4,15,0],
		"26f4-fe0f":[["\u26F4\uFE0F","\u26F4"],"","",["ferry"],57,5,15,0],
		"26f5":[["\u26F5"],"\uE01C","\uDBB9\uDFEA",["boat","sailboat"],57,6,15,0],
		"26f7-fe0f":[["\u26F7\uFE0F","\u26F7"],"","",["skier"],57,7,15,0],
		"26f8-fe0f":[["\u26F8\uFE0F","\u26F8"],"","",["ice_skate"],57,8,15,0],
		"26f9-fe0f-200d-2640-fe0f":[["\u26F9\uFE0F\u200D\u2640\uFE0F"],"","",["woman-bouncing-ball"],57,9,7,0],
		"26f9-fe0f-200d-2642-fe0f":[["\u26F9\uFE0F\u200D\u2642\uFE0F","\u26F9\uFE0F","\u26F9"],"","",["man-bouncing-ball","person_with_ball"],57,15,7,0],
		"26fa":[["\u26FA"],"\uE122","\uDBB9\uDFFB",["tent"],57,27,15,0],
		"26fd":[["\u26FD"],"\uE03A","\uDBB9\uDFF5",["fuelpump"],57,28,15,0],
		"2702-fe0f":[["\u2702\uFE0F","\u2702"],"\uE313","\uDBB9\uDD3E",["scissors"],57,29,15,0],
		"2705":[["\u2705"],"","\uDBBA\uDF4A",["white_check_mark"],57,30,15,0],
		"2708-fe0f":[["\u2708\uFE0F","\u2708"],"\uE01D","\uDBB9\uDFE9",["airplane"],57,31,15,0],
		"2709-fe0f":[["\u2709\uFE0F","\u2709"],"","\uDBB9\uDD29",["email","envelope"],57,32,15,0],
		"270a":[["\u270A"],"\uE010","\uDBBA\uDF93",["fist"],57,33,15,0],
		"270b":[["\u270B"],"\uE012","\uDBBA\uDF95",["hand","raised_hand"],57,39,15,0],
		"270c-fe0f":[["\u270C\uFE0F","\u270C"],"\uE011","\uDBBA\uDF94",["v"],57,45,15,0],
		"270d-fe0f":[["\u270D\uFE0F","\u270D"],"","",["writing_hand"],57,51,15,0],
		"270f-fe0f":[["\u270F\uFE0F","\u270F"],"","\uDBB9\uDD39",["pencil2"],57,57,15,0],
		"2712-fe0f":[["\u2712\uFE0F","\u2712"],"","\uDBB9\uDD36",["black_nib"],57,58,15,0],
		"2714-fe0f":[["\u2714\uFE0F","\u2714"],"","\uDBBA\uDF49",["heavy_check_mark"],57,59,15,0],
		"2716-fe0f":[["\u2716\uFE0F","\u2716"],"","\uDBBA\uDF53",["heavy_multiplication_x"],58,0,15,0],
		"271d-fe0f":[["\u271D\uFE0F","\u271D"],"","",["latin_cross"],58,1,15,0],
		"2721-fe0f":[["\u2721\uFE0F","\u2721"],"","",["star_of_david"],58,2,15,0],
		"2728":[["\u2728"],"\uE32E","\uDBBA\uDF60",["sparkles"],58,3,15,0],
		"2733-fe0f":[["\u2733\uFE0F","\u2733"],"\uE206","\uDBBA\uDF62",["eight_spoked_asterisk"],58,4,15,0],
		"2734-fe0f":[["\u2734\uFE0F","\u2734"],"\uE205","\uDBBA\uDF61",["eight_pointed_black_star"],58,5,15,0],
		"2744-fe0f":[["\u2744\uFE0F","\u2744"],"","\uDBB8\uDC0E",["snowflake"],58,6,15,0],
		"2747-fe0f":[["\u2747\uFE0F","\u2747"],"","\uDBBA\uDF77",["sparkle"],58,7,15,0],
		"274c":[["\u274C"],"\uE333","\uDBBA\uDF45",["x"],58,8,15,0],
		"274e":[["\u274E"],"","\uDBBA\uDF46",["negative_squared_cross_mark"],58,9,15,0],
		"2753":[["\u2753"],"\uE020","\uDBBA\uDF09",["question"],58,10,15,0],
		"2754":[["\u2754"],"\uE336","\uDBBA\uDF0A",["grey_question"],58,11,15,0],
		"2755":[["\u2755"],"\uE337","\uDBBA\uDF0B",["grey_exclamation"],58,12,15,0],
		"2757":[["\u2757"],"\uE021","\uDBBA\uDF04",["exclamation","heavy_exclamation_mark"],58,13,15,0],
		"2763-fe0f":[["\u2763\uFE0F","\u2763"],"","",["heavy_heart_exclamation_mark_ornament"],58,14,15,0],
		"2764-fe0f-200d-1f525":[["\u2764\uFE0F\u200D\uD83D\uDD25","\u2764\u200D\uD83D\uDD25"],"","",["heart_on_fire"],58,15,7,0],
		"2764-fe0f-200d-1fa79":[["\u2764\uFE0F\u200D\uD83E\uDE79","\u2764\u200D\uD83E\uDE79"],"","",["mending_heart"],58,16,7,0],
		"2764-fe0f":[["\u2764\uFE0F","\u2764"],"\uE022","\uDBBA\uDF0C",["heart"],58,17,15,0,"<3"],
		"2795":[["\u2795"],"","\uDBBA\uDF51",["heavy_plus_sign"],58,18,15,0],
		"2796":[["\u2796"],"","\uDBBA\uDF52",["heavy_minus_sign"],58,19,15,0],
		"2797":[["\u2797"],"","\uDBBA\uDF54",["heavy_division_sign"],58,20,15,0],
		"27a1-fe0f":[["\u27A1\uFE0F","\u27A1"],"\uE234","\uDBBA\uDEFA",["arrow_right"],58,21,15,0],
		"27b0":[["\u27B0"],"","\uDBBA\uDF08",["curly_loop"],58,22,15,0],
		"27bf":[["\u27BF"],"\uE211","\uDBBA\uDC2B",["loop"],58,23,15,0],
		"2934-fe0f":[["\u2934\uFE0F","\u2934"],"","\uDBBA\uDEF4",["arrow_heading_up"],58,24,15,0],
		"2935-fe0f":[["\u2935\uFE0F","\u2935"],"","\uDBBA\uDEF5",["arrow_heading_down"],58,25,15,0],
		"2b05-fe0f":[["\u2B05\uFE0F","\u2B05"],"\uE235","\uDBBA\uDEFB",["arrow_left"],58,26,15,0],
		"2b06-fe0f":[["\u2B06\uFE0F","\u2B06"],"\uE232","\uDBBA\uDEF8",["arrow_up"],58,27,15,0],
		"2b07-fe0f":[["\u2B07\uFE0F","\u2B07"],"\uE233","\uDBBA\uDEF9",["arrow_down"],58,28,15,0],
		"2b1b":[["\u2B1B"],"","\uDBBA\uDF6C",["black_large_square"],58,29,15,0],
		"2b1c":[["\u2B1C"],"","\uDBBA\uDF6B",["white_large_square"],58,30,15,0],
		"2b50":[["\u2B50"],"\uE32F","\uDBBA\uDF68",["star"],58,31,15,0],
		"2b55":[["\u2B55"],"\uE332","\uDBBA\uDF44",["o"],58,32,15,0],
		"3030-fe0f":[["\u3030\uFE0F","\u3030"],"","\uDBBA\uDF07",["wavy_dash"],58,33,15,0],
		"303d-fe0f":[["\u303D\uFE0F","\u303D"],"\uE12C","\uDBBA\uDC1B",["part_alternation_mark"],58,34,15,0],
		"3297-fe0f":[["\u3297\uFE0F","\u3297"],"\uE30D","\uDBBA\uDF43",["congratulations"],58,35,15,0],
		"3299-fe0f":[["\u3299\uFE0F","\u3299"],"\uE315","\uDBBA\uDF2B",["secret"],58,36,15,0]
	};
	/** @private */
	emoji.prototype.emoticons_data = {
		":o)":"monkey_face",
		"<\/3":"broken_heart",
		"=)":"smiley",
		"=-)":"smiley",
		"C:":"smile",
		"c:":"smile",
		":D":"smile",
		":-D":"smile",
		":>":"laughing",
		":->":"laughing",
		";)":"wink",
		";-)":"wink",
		"8)":"sunglasses",
		":|":"neutral_face",
		":-|":"neutral_face",
		":\\":"confused",
		":-\\":"confused",
		":\/":"confused",
		":-\/":"confused",
		":*":"kissing_heart",
		":-*":"kissing_heart",
		":p":"stuck_out_tongue",
		":-p":"stuck_out_tongue",
		":P":"stuck_out_tongue",
		":-P":"stuck_out_tongue",
		":b":"stuck_out_tongue",
		":-b":"stuck_out_tongue",
		";p":"stuck_out_tongue_winking_eye",
		";-p":"stuck_out_tongue_winking_eye",
		";b":"stuck_out_tongue_winking_eye",
		";-b":"stuck_out_tongue_winking_eye",
		";P":"stuck_out_tongue_winking_eye",
		";-P":"stuck_out_tongue_winking_eye",
		"):":"disappointed",
		":(":"disappointed",
		":-(":"disappointed",
		">:(":"angry",
		">:-(":"angry",
		":'(":"cry",
		"D:":"anguished",
		":o":"open_mouth",
		":-o":"open_mouth",
		":O":"open_mouth",
		":-O":"open_mouth",
		":)":"slightly_smiling_face",
		"(:":"slightly_smiling_face",
		":-)":"slightly_smiling_face",
		"<3":"heart"
	};
	/** @private */
	emoji.prototype.variations_data = {
		"1f385":{"1f3fb":["1f385-1f3fb",7,16,15,["\uD83C\uDF85\uD83C\uDFFB"]],"1f3fc":["1f385-1f3fc",7,17,15,["\uD83C\uDF85\uD83C\uDFFC"]],"1f3fd":["1f385-1f3fd",7,18,15,["\uD83C\uDF85\uD83C\uDFFD"]],"1f3fe":["1f385-1f3fe",7,19,15,["\uD83C\uDF85\uD83C\uDFFE"]],"1f3ff":["1f385-1f3ff",7,20,15,["\uD83C\uDF85\uD83C\uDFFF"]]},
		"1f3c2":{"1f3fb":["1f3c2-1f3fb",8,17,15,["\uD83C\uDFC2\uD83C\uDFFB"]],"1f3fc":["1f3c2-1f3fc",8,18,15,["\uD83C\uDFC2\uD83C\uDFFC"]],"1f3fd":["1f3c2-1f3fd",8,19,15,["\uD83C\uDFC2\uD83C\uDFFD"]],"1f3fe":["1f3c2-1f3fe",8,20,15,["\uD83C\uDFC2\uD83C\uDFFE"]],"1f3ff":["1f3c2-1f3ff",8,21,15,["\uD83C\uDFC2\uD83C\uDFFF"]]},
		"1f3c3-200d-2640-fe0f":{"1f3fb":["1f3c3-1f3fb-200d-2640-fe0f",8,23,15,["\uD83C\uDFC3\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f3c3-1f3fc-200d-2640-fe0f",8,24,15,["\uD83C\uDFC3\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f3c3-1f3fd-200d-2640-fe0f",8,25,15,["\uD83C\uDFC3\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f3c3-1f3fe-200d-2640-fe0f",8,26,15,["\uD83C\uDFC3\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f3c3-1f3ff-200d-2640-fe0f",8,27,15,["\uD83C\uDFC3\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f3c3-200d-2642-fe0f":{"1f3fb":["1f3c3-1f3fb-200d-2642-fe0f",8,29,15,["\uD83C\uDFC3\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83C\uDFC3\uD83C\uDFFB"]],"1f3fc":["1f3c3-1f3fc-200d-2642-fe0f",8,30,15,["\uD83C\uDFC3\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83C\uDFC3\uD83C\uDFFC"]],"1f3fd":["1f3c3-1f3fd-200d-2642-fe0f",8,31,15,["\uD83C\uDFC3\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83C\uDFC3\uD83C\uDFFD"]],"1f3fe":["1f3c3-1f3fe-200d-2642-fe0f",8,32,15,["\uD83C\uDFC3\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83C\uDFC3\uD83C\uDFFE"]],"1f3ff":["1f3c3-1f3ff-200d-2642-fe0f",8,33,15,["\uD83C\uDFC3\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83C\uDFC3\uD83C\uDFFF"]]},
		"1f3c4-200d-2640-fe0f":{"1f3fb":["1f3c4-1f3fb-200d-2640-fe0f",8,41,15,["\uD83C\uDFC4\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f3c4-1f3fc-200d-2640-fe0f",8,42,15,["\uD83C\uDFC4\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f3c4-1f3fd-200d-2640-fe0f",8,43,15,["\uD83C\uDFC4\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f3c4-1f3fe-200d-2640-fe0f",8,44,15,["\uD83C\uDFC4\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f3c4-1f3ff-200d-2640-fe0f",8,45,15,["\uD83C\uDFC4\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f3c4-200d-2642-fe0f":{"1f3fb":["1f3c4-1f3fb-200d-2642-fe0f",8,47,15,["\uD83C\uDFC4\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83C\uDFC4\uD83C\uDFFB"]],"1f3fc":["1f3c4-1f3fc-200d-2642-fe0f",8,48,15,["\uD83C\uDFC4\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83C\uDFC4\uD83C\uDFFC"]],"1f3fd":["1f3c4-1f3fd-200d-2642-fe0f",8,49,15,["\uD83C\uDFC4\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83C\uDFC4\uD83C\uDFFD"]],"1f3fe":["1f3c4-1f3fe-200d-2642-fe0f",8,50,15,["\uD83C\uDFC4\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83C\uDFC4\uD83C\uDFFE"]],"1f3ff":["1f3c4-1f3ff-200d-2642-fe0f",8,51,15,["\uD83C\uDFC4\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83C\uDFC4\uD83C\uDFFF"]]},
		"1f3c7":{"1f3fb":["1f3c7-1f3fb",9,1,15,["\uD83C\uDFC7\uD83C\uDFFB"]],"1f3fc":["1f3c7-1f3fc",9,2,15,["\uD83C\uDFC7\uD83C\uDFFC"]],"1f3fd":["1f3c7-1f3fd",9,3,15,["\uD83C\uDFC7\uD83C\uDFFD"]],"1f3fe":["1f3c7-1f3fe",9,4,15,["\uD83C\uDFC7\uD83C\uDFFE"]],"1f3ff":["1f3c7-1f3ff",9,5,15,["\uD83C\uDFC7\uD83C\uDFFF"]]},
		"1f3ca-200d-2640-fe0f":{"1f3fb":["1f3ca-1f3fb-200d-2640-fe0f",9,9,15,["\uD83C\uDFCA\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f3ca-1f3fc-200d-2640-fe0f",9,10,15,["\uD83C\uDFCA\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f3ca-1f3fd-200d-2640-fe0f",9,11,15,["\uD83C\uDFCA\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f3ca-1f3fe-200d-2640-fe0f",9,12,15,["\uD83C\uDFCA\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f3ca-1f3ff-200d-2640-fe0f",9,13,15,["\uD83C\uDFCA\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f3ca-200d-2642-fe0f":{"1f3fb":["1f3ca-1f3fb-200d-2642-fe0f",9,15,15,["\uD83C\uDFCA\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83C\uDFCA\uD83C\uDFFB"]],"1f3fc":["1f3ca-1f3fc-200d-2642-fe0f",9,16,15,["\uD83C\uDFCA\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83C\uDFCA\uD83C\uDFFC"]],"1f3fd":["1f3ca-1f3fd-200d-2642-fe0f",9,17,15,["\uD83C\uDFCA\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83C\uDFCA\uD83C\uDFFD"]],"1f3fe":["1f3ca-1f3fe-200d-2642-fe0f",9,18,15,["\uD83C\uDFCA\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83C\uDFCA\uD83C\uDFFE"]],"1f3ff":["1f3ca-1f3ff-200d-2642-fe0f",9,19,15,["\uD83C\uDFCA\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83C\uDFCA\uD83C\uDFFF"]]},
		"1f3cb-fe0f-200d-2640-fe0f":{"1f3fb":["1f3cb-1f3fb-200d-2640-fe0f",9,27,15,["\uD83C\uDFCB\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f3cb-1f3fc-200d-2640-fe0f",9,28,15,["\uD83C\uDFCB\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f3cb-1f3fd-200d-2640-fe0f",9,29,15,["\uD83C\uDFCB\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f3cb-1f3fe-200d-2640-fe0f",9,30,15,["\uD83C\uDFCB\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f3cb-1f3ff-200d-2640-fe0f",9,31,15,["\uD83C\uDFCB\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f3cb-fe0f-200d-2642-fe0f":{"1f3fb":["1f3cb-1f3fb-200d-2642-fe0f",9,33,15,["\uD83C\uDFCB\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83C\uDFCB\uD83C\uDFFB"]],"1f3fc":["1f3cb-1f3fc-200d-2642-fe0f",9,34,15,["\uD83C\uDFCB\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83C\uDFCB\uD83C\uDFFC"]],"1f3fd":["1f3cb-1f3fd-200d-2642-fe0f",9,35,15,["\uD83C\uDFCB\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83C\uDFCB\uD83C\uDFFD"]],"1f3fe":["1f3cb-1f3fe-200d-2642-fe0f",9,36,15,["\uD83C\uDFCB\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83C\uDFCB\uD83C\uDFFE"]],"1f3ff":["1f3cb-1f3ff-200d-2642-fe0f",9,37,15,["\uD83C\uDFCB\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83C\uDFCB\uD83C\uDFFF"]]},
		"1f3cc-fe0f-200d-2640-fe0f":{"1f3fb":["1f3cc-1f3fb-200d-2640-fe0f",9,45,15,["\uD83C\uDFCC\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f3cc-1f3fc-200d-2640-fe0f",9,46,15,["\uD83C\uDFCC\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f3cc-1f3fd-200d-2640-fe0f",9,47,15,["\uD83C\uDFCC\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f3cc-1f3fe-200d-2640-fe0f",9,48,15,["\uD83C\uDFCC\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f3cc-1f3ff-200d-2640-fe0f",9,49,15,["\uD83C\uDFCC\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f3cc-fe0f-200d-2642-fe0f":{"1f3fb":["1f3cc-1f3fb-200d-2642-fe0f",9,51,15,["\uD83C\uDFCC\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83C\uDFCC\uD83C\uDFFB"]],"1f3fc":["1f3cc-1f3fc-200d-2642-fe0f",9,52,15,["\uD83C\uDFCC\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83C\uDFCC\uD83C\uDFFC"]],"1f3fd":["1f3cc-1f3fd-200d-2642-fe0f",9,53,15,["\uD83C\uDFCC\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83C\uDFCC\uD83C\uDFFD"]],"1f3fe":["1f3cc-1f3fe-200d-2642-fe0f",9,54,15,["\uD83C\uDFCC\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83C\uDFCC\uD83C\uDFFE"]],"1f3ff":["1f3cc-1f3ff-200d-2642-fe0f",9,55,15,["\uD83C\uDFCC\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83C\uDFCC\uD83C\uDFFF"]]},
		"1f442":{"1f3fb":["1f442-1f3fb",12,7,15,["\uD83D\uDC42\uD83C\uDFFB"]],"1f3fc":["1f442-1f3fc",12,8,15,["\uD83D\uDC42\uD83C\uDFFC"]],"1f3fd":["1f442-1f3fd",12,9,15,["\uD83D\uDC42\uD83C\uDFFD"]],"1f3fe":["1f442-1f3fe",12,10,15,["\uD83D\uDC42\uD83C\uDFFE"]],"1f3ff":["1f442-1f3ff",12,11,15,["\uD83D\uDC42\uD83C\uDFFF"]]},
		"1f443":{"1f3fb":["1f443-1f3fb",12,13,15,["\uD83D\uDC43\uD83C\uDFFB"]],"1f3fc":["1f443-1f3fc",12,14,15,["\uD83D\uDC43\uD83C\uDFFC"]],"1f3fd":["1f443-1f3fd",12,15,15,["\uD83D\uDC43\uD83C\uDFFD"]],"1f3fe":["1f443-1f3fe",12,16,15,["\uD83D\uDC43\uD83C\uDFFE"]],"1f3ff":["1f443-1f3ff",12,17,15,["\uD83D\uDC43\uD83C\uDFFF"]]},
		"1f446":{"1f3fb":["1f446-1f3fb",12,21,15,["\uD83D\uDC46\uD83C\uDFFB"]],"1f3fc":["1f446-1f3fc",12,22,15,["\uD83D\uDC46\uD83C\uDFFC"]],"1f3fd":["1f446-1f3fd",12,23,15,["\uD83D\uDC46\uD83C\uDFFD"]],"1f3fe":["1f446-1f3fe",12,24,15,["\uD83D\uDC46\uD83C\uDFFE"]],"1f3ff":["1f446-1f3ff",12,25,15,["\uD83D\uDC46\uD83C\uDFFF"]]},
		"1f447":{"1f3fb":["1f447-1f3fb",12,27,15,["\uD83D\uDC47\uD83C\uDFFB"]],"1f3fc":["1f447-1f3fc",12,28,15,["\uD83D\uDC47\uD83C\uDFFC"]],"1f3fd":["1f447-1f3fd",12,29,15,["\uD83D\uDC47\uD83C\uDFFD"]],"1f3fe":["1f447-1f3fe",12,30,15,["\uD83D\uDC47\uD83C\uDFFE"]],"1f3ff":["1f447-1f3ff",12,31,15,["\uD83D\uDC47\uD83C\uDFFF"]]},
		"1f448":{"1f3fb":["1f448-1f3fb",12,33,15,["\uD83D\uDC48\uD83C\uDFFB"]],"1f3fc":["1f448-1f3fc",12,34,15,["\uD83D\uDC48\uD83C\uDFFC"]],"1f3fd":["1f448-1f3fd",12,35,15,["\uD83D\uDC48\uD83C\uDFFD"]],"1f3fe":["1f448-1f3fe",12,36,15,["\uD83D\uDC48\uD83C\uDFFE"]],"1f3ff":["1f448-1f3ff",12,37,15,["\uD83D\uDC48\uD83C\uDFFF"]]},
		"1f449":{"1f3fb":["1f449-1f3fb",12,39,15,["\uD83D\uDC49\uD83C\uDFFB"]],"1f3fc":["1f449-1f3fc",12,40,15,["\uD83D\uDC49\uD83C\uDFFC"]],"1f3fd":["1f449-1f3fd",12,41,15,["\uD83D\uDC49\uD83C\uDFFD"]],"1f3fe":["1f449-1f3fe",12,42,15,["\uD83D\uDC49\uD83C\uDFFE"]],"1f3ff":["1f449-1f3ff",12,43,15,["\uD83D\uDC49\uD83C\uDFFF"]]},
		"1f44a":{"1f3fb":["1f44a-1f3fb",12,45,15,["\uD83D\uDC4A\uD83C\uDFFB"]],"1f3fc":["1f44a-1f3fc",12,46,15,["\uD83D\uDC4A\uD83C\uDFFC"]],"1f3fd":["1f44a-1f3fd",12,47,15,["\uD83D\uDC4A\uD83C\uDFFD"]],"1f3fe":["1f44a-1f3fe",12,48,15,["\uD83D\uDC4A\uD83C\uDFFE"]],"1f3ff":["1f44a-1f3ff",12,49,15,["\uD83D\uDC4A\uD83C\uDFFF"]]},
		"1f44b":{"1f3fb":["1f44b-1f3fb",12,51,15,["\uD83D\uDC4B\uD83C\uDFFB"]],"1f3fc":["1f44b-1f3fc",12,52,15,["\uD83D\uDC4B\uD83C\uDFFC"]],"1f3fd":["1f44b-1f3fd",12,53,15,["\uD83D\uDC4B\uD83C\uDFFD"]],"1f3fe":["1f44b-1f3fe",12,54,15,["\uD83D\uDC4B\uD83C\uDFFE"]],"1f3ff":["1f44b-1f3ff",12,55,15,["\uD83D\uDC4B\uD83C\uDFFF"]]},
		"1f44c":{"1f3fb":["1f44c-1f3fb",12,57,15,["\uD83D\uDC4C\uD83C\uDFFB"]],"1f3fc":["1f44c-1f3fc",12,58,15,["\uD83D\uDC4C\uD83C\uDFFC"]],"1f3fd":["1f44c-1f3fd",12,59,15,["\uD83D\uDC4C\uD83C\uDFFD"]],"1f3fe":["1f44c-1f3fe",13,0,15,["\uD83D\uDC4C\uD83C\uDFFE"]],"1f3ff":["1f44c-1f3ff",13,1,15,["\uD83D\uDC4C\uD83C\uDFFF"]]},
		"1f44d":{"1f3fb":["1f44d-1f3fb",13,3,15,["\uD83D\uDC4D\uD83C\uDFFB"]],"1f3fc":["1f44d-1f3fc",13,4,15,["\uD83D\uDC4D\uD83C\uDFFC"]],"1f3fd":["1f44d-1f3fd",13,5,15,["\uD83D\uDC4D\uD83C\uDFFD"]],"1f3fe":["1f44d-1f3fe",13,6,15,["\uD83D\uDC4D\uD83C\uDFFE"]],"1f3ff":["1f44d-1f3ff",13,7,15,["\uD83D\uDC4D\uD83C\uDFFF"]]},
		"1f44e":{"1f3fb":["1f44e-1f3fb",13,9,15,["\uD83D\uDC4E\uD83C\uDFFB"]],"1f3fc":["1f44e-1f3fc",13,10,15,["\uD83D\uDC4E\uD83C\uDFFC"]],"1f3fd":["1f44e-1f3fd",13,11,15,["\uD83D\uDC4E\uD83C\uDFFD"]],"1f3fe":["1f44e-1f3fe",13,12,15,["\uD83D\uDC4E\uD83C\uDFFE"]],"1f3ff":["1f44e-1f3ff",13,13,15,["\uD83D\uDC4E\uD83C\uDFFF"]]},
		"1f44f":{"1f3fb":["1f44f-1f3fb",13,15,15,["\uD83D\uDC4F\uD83C\uDFFB"]],"1f3fc":["1f44f-1f3fc",13,16,15,["\uD83D\uDC4F\uD83C\uDFFC"]],"1f3fd":["1f44f-1f3fd",13,17,15,["\uD83D\uDC4F\uD83C\uDFFD"]],"1f3fe":["1f44f-1f3fe",13,18,15,["\uD83D\uDC4F\uD83C\uDFFE"]],"1f3ff":["1f44f-1f3ff",13,19,15,["\uD83D\uDC4F\uD83C\uDFFF"]]},
		"1f450":{"1f3fb":["1f450-1f3fb",13,21,15,["\uD83D\uDC50\uD83C\uDFFB"]],"1f3fc":["1f450-1f3fc",13,22,15,["\uD83D\uDC50\uD83C\uDFFC"]],"1f3fd":["1f450-1f3fd",13,23,15,["\uD83D\uDC50\uD83C\uDFFD"]],"1f3fe":["1f450-1f3fe",13,24,15,["\uD83D\uDC50\uD83C\uDFFE"]],"1f3ff":["1f450-1f3ff",13,25,15,["\uD83D\uDC50\uD83C\uDFFF"]]},
		"1f466":{"1f3fb":["1f466-1f3fb",13,48,15,["\uD83D\uDC66\uD83C\uDFFB"]],"1f3fc":["1f466-1f3fc",13,49,15,["\uD83D\uDC66\uD83C\uDFFC"]],"1f3fd":["1f466-1f3fd",13,50,15,["\uD83D\uDC66\uD83C\uDFFD"]],"1f3fe":["1f466-1f3fe",13,51,15,["\uD83D\uDC66\uD83C\uDFFE"]],"1f3ff":["1f466-1f3ff",13,52,15,["\uD83D\uDC66\uD83C\uDFFF"]]},
		"1f467":{"1f3fb":["1f467-1f3fb",13,54,15,["\uD83D\uDC67\uD83C\uDFFB"]],"1f3fc":["1f467-1f3fc",13,55,15,["\uD83D\uDC67\uD83C\uDFFC"]],"1f3fd":["1f467-1f3fd",13,56,15,["\uD83D\uDC67\uD83C\uDFFD"]],"1f3fe":["1f467-1f3fe",13,57,15,["\uD83D\uDC67\uD83C\uDFFE"]],"1f3ff":["1f467-1f3ff",13,58,15,["\uD83D\uDC67\uD83C\uDFFF"]]},
		"1f468-200d-1f33e":{"1f3fb":["1f468-1f3fb-200d-1f33e",14,0,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDF3E"]],"1f3fc":["1f468-1f3fc-200d-1f33e",14,1,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDF3E"]],"1f3fd":["1f468-1f3fd-200d-1f33e",14,2,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDF3E"]],"1f3fe":["1f468-1f3fe-200d-1f33e",14,3,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDF3E"]],"1f3ff":["1f468-1f3ff-200d-1f33e",14,4,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDF3E"]]},
		"1f468-200d-1f373":{"1f3fb":["1f468-1f3fb-200d-1f373",14,6,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDF73"]],"1f3fc":["1f468-1f3fc-200d-1f373",14,7,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDF73"]],"1f3fd":["1f468-1f3fd-200d-1f373",14,8,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDF73"]],"1f3fe":["1f468-1f3fe-200d-1f373",14,9,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDF73"]],"1f3ff":["1f468-1f3ff-200d-1f373",14,10,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDF73"]]},
		"1f468-200d-1f37c":{"1f3fb":["1f468-1f3fb-200d-1f37c",14,12,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDF7C"]],"1f3fc":["1f468-1f3fc-200d-1f37c",14,13,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDF7C"]],"1f3fd":["1f468-1f3fd-200d-1f37c",14,14,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDF7C"]],"1f3fe":["1f468-1f3fe-200d-1f37c",14,15,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDF7C"]],"1f3ff":["1f468-1f3ff-200d-1f37c",14,16,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDF7C"]]},
		"1f468-200d-1f393":{"1f3fb":["1f468-1f3fb-200d-1f393",14,18,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDF93"]],"1f3fc":["1f468-1f3fc-200d-1f393",14,19,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDF93"]],"1f3fd":["1f468-1f3fd-200d-1f393",14,20,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDF93"]],"1f3fe":["1f468-1f3fe-200d-1f393",14,21,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDF93"]],"1f3ff":["1f468-1f3ff-200d-1f393",14,22,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDF93"]]},
		"1f468-200d-1f3a4":{"1f3fb":["1f468-1f3fb-200d-1f3a4",14,24,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDFA4"]],"1f3fc":["1f468-1f3fc-200d-1f3a4",14,25,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDFA4"]],"1f3fd":["1f468-1f3fd-200d-1f3a4",14,26,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDFA4"]],"1f3fe":["1f468-1f3fe-200d-1f3a4",14,27,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDFA4"]],"1f3ff":["1f468-1f3ff-200d-1f3a4",14,28,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDFA4"]]},
		"1f468-200d-1f3a8":{"1f3fb":["1f468-1f3fb-200d-1f3a8",14,30,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDFA8"]],"1f3fc":["1f468-1f3fc-200d-1f3a8",14,31,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDFA8"]],"1f3fd":["1f468-1f3fd-200d-1f3a8",14,32,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDFA8"]],"1f3fe":["1f468-1f3fe-200d-1f3a8",14,33,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDFA8"]],"1f3ff":["1f468-1f3ff-200d-1f3a8",14,34,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDFA8"]]},
		"1f468-200d-1f3eb":{"1f3fb":["1f468-1f3fb-200d-1f3eb",14,36,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDFEB"]],"1f3fc":["1f468-1f3fc-200d-1f3eb",14,37,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDFEB"]],"1f3fd":["1f468-1f3fd-200d-1f3eb",14,38,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDFEB"]],"1f3fe":["1f468-1f3fe-200d-1f3eb",14,39,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDFEB"]],"1f3ff":["1f468-1f3ff-200d-1f3eb",14,40,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDFEB"]]},
		"1f468-200d-1f3ed":{"1f3fb":["1f468-1f3fb-200d-1f3ed",14,42,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83C\uDFED"]],"1f3fc":["1f468-1f3fc-200d-1f3ed",14,43,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83C\uDFED"]],"1f3fd":["1f468-1f3fd-200d-1f3ed",14,44,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83C\uDFED"]],"1f3fe":["1f468-1f3fe-200d-1f3ed",14,45,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83C\uDFED"]],"1f3ff":["1f468-1f3ff-200d-1f3ed",14,46,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83C\uDFED"]]},
		"1f468-200d-1f4bb":{"1f3fb":["1f468-1f3fb-200d-1f4bb",15,3,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDCBB"]],"1f3fc":["1f468-1f3fc-200d-1f4bb",15,4,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDCBB"]],"1f3fd":["1f468-1f3fd-200d-1f4bb",15,5,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDCBB"]],"1f3fe":["1f468-1f3fe-200d-1f4bb",15,6,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDCBB"]],"1f3ff":["1f468-1f3ff-200d-1f4bb",15,7,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDCBB"]]},
		"1f468-200d-1f4bc":{"1f3fb":["1f468-1f3fb-200d-1f4bc",15,9,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDCBC"]],"1f3fc":["1f468-1f3fc-200d-1f4bc",15,10,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDCBC"]],"1f3fd":["1f468-1f3fd-200d-1f4bc",15,11,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDCBC"]],"1f3fe":["1f468-1f3fe-200d-1f4bc",15,12,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDCBC"]],"1f3ff":["1f468-1f3ff-200d-1f4bc",15,13,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDCBC"]]},
		"1f468-200d-1f527":{"1f3fb":["1f468-1f3fb-200d-1f527",15,15,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDD27"]],"1f3fc":["1f468-1f3fc-200d-1f527",15,16,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDD27"]],"1f3fd":["1f468-1f3fd-200d-1f527",15,17,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDD27"]],"1f3fe":["1f468-1f3fe-200d-1f527",15,18,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDD27"]],"1f3ff":["1f468-1f3ff-200d-1f527",15,19,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDD27"]]},
		"1f468-200d-1f52c":{"1f3fb":["1f468-1f3fb-200d-1f52c",15,21,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDD2C"]],"1f3fc":["1f468-1f3fc-200d-1f52c",15,22,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDD2C"]],"1f3fd":["1f468-1f3fd-200d-1f52c",15,23,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDD2C"]],"1f3fe":["1f468-1f3fe-200d-1f52c",15,24,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDD2C"]],"1f3ff":["1f468-1f3ff-200d-1f52c",15,25,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDD2C"]]},
		"1f468-200d-1f680":{"1f3fb":["1f468-1f3fb-200d-1f680",15,27,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDE80"]],"1f3fc":["1f468-1f3fc-200d-1f680",15,28,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDE80"]],"1f3fd":["1f468-1f3fd-200d-1f680",15,29,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDE80"]],"1f3fe":["1f468-1f3fe-200d-1f680",15,30,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDE80"]],"1f3ff":["1f468-1f3ff-200d-1f680",15,31,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDE80"]]},
		"1f468-200d-1f692":{"1f3fb":["1f468-1f3fb-200d-1f692",15,33,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83D\uDE92"]],"1f3fc":["1f468-1f3fc-200d-1f692",15,34,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83D\uDE92"]],"1f3fd":["1f468-1f3fd-200d-1f692",15,35,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83D\uDE92"]],"1f3fe":["1f468-1f3fe-200d-1f692",15,36,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83D\uDE92"]],"1f3ff":["1f468-1f3ff-200d-1f692",15,37,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDE92"]]},
		"1f468-200d-1f9af":{"1f3fb":["1f468-1f3fb-200d-1f9af",15,39,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDAF"]],"1f3fc":["1f468-1f3fc-200d-1f9af",15,40,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDAF"]],"1f3fd":["1f468-1f3fd-200d-1f9af",15,41,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDAF"]],"1f3fe":["1f468-1f3fe-200d-1f9af",15,42,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDAF"]],"1f3ff":["1f468-1f3ff-200d-1f9af",15,43,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDAF"]]},
		"1f468-200d-1f9b0":{"1f3fb":["1f468-1f3fb-200d-1f9b0",15,45,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDB0"]],"1f3fc":["1f468-1f3fc-200d-1f9b0",15,46,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDB0"]],"1f3fd":["1f468-1f3fd-200d-1f9b0",15,47,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDB0"]],"1f3fe":["1f468-1f3fe-200d-1f9b0",15,48,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDB0"]],"1f3ff":["1f468-1f3ff-200d-1f9b0",15,49,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDB0"]]},
		"1f468-200d-1f9b1":{"1f3fb":["1f468-1f3fb-200d-1f9b1",15,51,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDB1"]],"1f3fc":["1f468-1f3fc-200d-1f9b1",15,52,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDB1"]],"1f3fd":["1f468-1f3fd-200d-1f9b1",15,53,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDB1"]],"1f3fe":["1f468-1f3fe-200d-1f9b1",15,54,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDB1"]],"1f3ff":["1f468-1f3ff-200d-1f9b1",15,55,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDB1"]]},
		"1f468-200d-1f9b2":{"1f3fb":["1f468-1f3fb-200d-1f9b2",15,57,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDB2"]],"1f3fc":["1f468-1f3fc-200d-1f9b2",15,58,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDB2"]],"1f3fd":["1f468-1f3fd-200d-1f9b2",15,59,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDB2"]],"1f3fe":["1f468-1f3fe-200d-1f9b2",16,0,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDB2"]],"1f3ff":["1f468-1f3ff-200d-1f9b2",16,1,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDB2"]]},
		"1f468-200d-1f9b3":{"1f3fb":["1f468-1f3fb-200d-1f9b3",16,3,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDB3"]],"1f3fc":["1f468-1f3fc-200d-1f9b3",16,4,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDB3"]],"1f3fd":["1f468-1f3fd-200d-1f9b3",16,5,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDB3"]],"1f3fe":["1f468-1f3fe-200d-1f9b3",16,6,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDB3"]],"1f3ff":["1f468-1f3ff-200d-1f9b3",16,7,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDB3"]]},
		"1f468-200d-1f9bc":{"1f3fb":["1f468-1f3fb-200d-1f9bc",16,9,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDBC"]],"1f3fc":["1f468-1f3fc-200d-1f9bc",16,10,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDBC"]],"1f3fd":["1f468-1f3fd-200d-1f9bc",16,11,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDBC"]],"1f3fe":["1f468-1f3fe-200d-1f9bc",16,12,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDBC"]],"1f3ff":["1f468-1f3ff-200d-1f9bc",16,13,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDBC"]]},
		"1f468-200d-1f9bd":{"1f3fb":["1f468-1f3fb-200d-1f9bd",16,15,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDDBD"]],"1f3fc":["1f468-1f3fc-200d-1f9bd",16,16,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDBD"]],"1f3fd":["1f468-1f3fd-200d-1f9bd",16,17,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDDBD"]],"1f3fe":["1f468-1f3fe-200d-1f9bd",16,18,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDDBD"]],"1f3ff":["1f468-1f3ff-200d-1f9bd",16,19,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDDBD"]]},
		"1f468-200d-2695-fe0f":{"1f3fb":["1f468-1f3fb-200d-2695-fe0f",16,21,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2695\uFE0F"]],"1f3fc":["1f468-1f3fc-200d-2695-fe0f",16,22,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2695\uFE0F"]],"1f3fd":["1f468-1f3fd-200d-2695-fe0f",16,23,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2695\uFE0F"]],"1f3fe":["1f468-1f3fe-200d-2695-fe0f",16,24,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2695\uFE0F"]],"1f3ff":["1f468-1f3ff-200d-2695-fe0f",16,25,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2695\uFE0F"]]},
		"1f468-200d-2696-fe0f":{"1f3fb":["1f468-1f3fb-200d-2696-fe0f",16,27,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2696\uFE0F"]],"1f3fc":["1f468-1f3fc-200d-2696-fe0f",16,28,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2696\uFE0F"]],"1f3fd":["1f468-1f3fd-200d-2696-fe0f",16,29,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2696\uFE0F"]],"1f3fe":["1f468-1f3fe-200d-2696-fe0f",16,30,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2696\uFE0F"]],"1f3ff":["1f468-1f3ff-200d-2696-fe0f",16,31,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2696\uFE0F"]]},
		"1f468-200d-2708-fe0f":{"1f3fb":["1f468-1f3fb-200d-2708-fe0f",16,33,15,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2708\uFE0F"]],"1f3fc":["1f468-1f3fc-200d-2708-fe0f",16,34,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2708\uFE0F"]],"1f3fd":["1f468-1f3fd-200d-2708-fe0f",16,35,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2708\uFE0F"]],"1f3fe":["1f468-1f3fe-200d-2708-fe0f",16,36,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2708\uFE0F"]],"1f3ff":["1f468-1f3ff-200d-2708-fe0f",16,37,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2708\uFE0F"]]},
		"1f468-200d-2764-fe0f-200d-1f468":{"1f3fb-1f3fb":["1f468-1f3fb-200d-2764-fe0f-200d-1f468-1f3fb",16,39,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f468-1f3fb-200d-2764-fe0f-200d-1f468-1f3fc",16,40,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f468-1f3fb-200d-2764-fe0f-200d-1f468-1f3fd",16,41,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f468-1f3fb-200d-2764-fe0f-200d-1f468-1f3fe",16,42,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f468-1f3fb-200d-2764-fe0f-200d-1f468-1f3ff",16,43,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f468-1f3fc-200d-2764-fe0f-200d-1f468-1f3fb",16,44,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f468-1f3fc-200d-2764-fe0f-200d-1f468-1f3fc",16,45,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f468-1f3fc-200d-2764-fe0f-200d-1f468-1f3fd",16,46,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f468-1f3fc-200d-2764-fe0f-200d-1f468-1f3fe",16,47,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f468-1f3fc-200d-2764-fe0f-200d-1f468-1f3ff",16,48,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f468-1f3fd-200d-2764-fe0f-200d-1f468-1f3fb",16,49,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f468-1f3fd-200d-2764-fe0f-200d-1f468-1f3fc",16,50,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f468-1f3fd-200d-2764-fe0f-200d-1f468-1f3fd",16,51,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f468-1f3fd-200d-2764-fe0f-200d-1f468-1f3fe",16,52,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f468-1f3fd-200d-2764-fe0f-200d-1f468-1f3ff",16,53,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f468-1f3fe-200d-2764-fe0f-200d-1f468-1f3fb",16,54,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f468-1f3fe-200d-2764-fe0f-200d-1f468-1f3fc",16,55,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f468-1f3fe-200d-2764-fe0f-200d-1f468-1f3fd",16,56,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f468-1f3fe-200d-2764-fe0f-200d-1f468-1f3fe",16,57,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f468-1f3fe-200d-2764-fe0f-200d-1f468-1f3ff",16,58,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f468-1f3ff-200d-2764-fe0f-200d-1f468-1f3fb",16,59,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f468-1f3ff-200d-2764-fe0f-200d-1f468-1f3fc",17,0,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f468-1f3ff-200d-2764-fe0f-200d-1f468-1f3fd",17,1,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f468-1f3ff-200d-2764-fe0f-200d-1f468-1f3fe",17,2,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f468-1f3ff-200d-2764-fe0f-200d-1f468-1f3ff",17,3,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]]},
		"1f468-200d-2764-fe0f-200d-1f48b-200d-1f468":{"1f3fb-1f3fb":["1f468-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",17,5,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f468-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",17,6,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f468-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",17,7,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f468-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",17,8,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f468-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",17,9,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f468-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",17,10,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f468-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",17,11,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f468-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",17,12,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f468-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",17,13,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f468-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",17,14,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f468-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",17,15,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f468-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",17,16,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f468-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",17,17,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f468-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",17,18,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f468-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",17,19,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f468-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",17,20,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f468-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",17,21,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f468-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",17,22,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f468-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",17,23,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f468-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",17,24,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f468-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",17,25,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f468-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",17,26,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f468-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",17,27,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f468-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",17,28,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f468-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",17,29,7,["\uD83D\uDC68\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]]},
		"1f468":{"1f3fb":["1f468-1f3fb",17,31,15,["\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc":["1f468-1f3fc",17,32,15,["\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd":["1f468-1f3fd",17,33,15,["\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe":["1f468-1f3fe",17,34,15,["\uD83D\uDC68\uD83C\uDFFE"]],"1f3ff":["1f468-1f3ff",17,35,15,["\uD83D\uDC68\uD83C\uDFFF"]]},
		"1f469-200d-1f33e":{"1f3fb":["1f469-1f3fb-200d-1f33e",17,37,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDF3E"]],"1f3fc":["1f469-1f3fc-200d-1f33e",17,38,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDF3E"]],"1f3fd":["1f469-1f3fd-200d-1f33e",17,39,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDF3E"]],"1f3fe":["1f469-1f3fe-200d-1f33e",17,40,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDF3E"]],"1f3ff":["1f469-1f3ff-200d-1f33e",17,41,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDF3E"]]},
		"1f469-200d-1f373":{"1f3fb":["1f469-1f3fb-200d-1f373",17,43,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDF73"]],"1f3fc":["1f469-1f3fc-200d-1f373",17,44,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDF73"]],"1f3fd":["1f469-1f3fd-200d-1f373",17,45,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDF73"]],"1f3fe":["1f469-1f3fe-200d-1f373",17,46,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDF73"]],"1f3ff":["1f469-1f3ff-200d-1f373",17,47,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDF73"]]},
		"1f469-200d-1f37c":{"1f3fb":["1f469-1f3fb-200d-1f37c",17,49,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDF7C"]],"1f3fc":["1f469-1f3fc-200d-1f37c",17,50,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDF7C"]],"1f3fd":["1f469-1f3fd-200d-1f37c",17,51,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDF7C"]],"1f3fe":["1f469-1f3fe-200d-1f37c",17,52,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDF7C"]],"1f3ff":["1f469-1f3ff-200d-1f37c",17,53,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDF7C"]]},
		"1f469-200d-1f393":{"1f3fb":["1f469-1f3fb-200d-1f393",17,55,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDF93"]],"1f3fc":["1f469-1f3fc-200d-1f393",17,56,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDF93"]],"1f3fd":["1f469-1f3fd-200d-1f393",17,57,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDF93"]],"1f3fe":["1f469-1f3fe-200d-1f393",17,58,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDF93"]],"1f3ff":["1f469-1f3ff-200d-1f393",17,59,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDF93"]]},
		"1f469-200d-1f3a4":{"1f3fb":["1f469-1f3fb-200d-1f3a4",18,1,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDFA4"]],"1f3fc":["1f469-1f3fc-200d-1f3a4",18,2,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDFA4"]],"1f3fd":["1f469-1f3fd-200d-1f3a4",18,3,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDFA4"]],"1f3fe":["1f469-1f3fe-200d-1f3a4",18,4,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDFA4"]],"1f3ff":["1f469-1f3ff-200d-1f3a4",18,5,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDFA4"]]},
		"1f469-200d-1f3a8":{"1f3fb":["1f469-1f3fb-200d-1f3a8",18,7,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDFA8"]],"1f3fc":["1f469-1f3fc-200d-1f3a8",18,8,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDFA8"]],"1f3fd":["1f469-1f3fd-200d-1f3a8",18,9,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDFA8"]],"1f3fe":["1f469-1f3fe-200d-1f3a8",18,10,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDFA8"]],"1f3ff":["1f469-1f3ff-200d-1f3a8",18,11,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDFA8"]]},
		"1f469-200d-1f3eb":{"1f3fb":["1f469-1f3fb-200d-1f3eb",18,13,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDFEB"]],"1f3fc":["1f469-1f3fc-200d-1f3eb",18,14,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDFEB"]],"1f3fd":["1f469-1f3fd-200d-1f3eb",18,15,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDFEB"]],"1f3fe":["1f469-1f3fe-200d-1f3eb",18,16,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDFEB"]],"1f3ff":["1f469-1f3ff-200d-1f3eb",18,17,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDFEB"]]},
		"1f469-200d-1f3ed":{"1f3fb":["1f469-1f3fb-200d-1f3ed",18,19,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83C\uDFED"]],"1f3fc":["1f469-1f3fc-200d-1f3ed",18,20,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83C\uDFED"]],"1f3fd":["1f469-1f3fd-200d-1f3ed",18,21,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83C\uDFED"]],"1f3fe":["1f469-1f3fe-200d-1f3ed",18,22,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83C\uDFED"]],"1f3ff":["1f469-1f3ff-200d-1f3ed",18,23,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83C\uDFED"]]},
		"1f469-200d-1f4bb":{"1f3fb":["1f469-1f3fb-200d-1f4bb",18,35,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDCBB"]],"1f3fc":["1f469-1f3fc-200d-1f4bb",18,36,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDCBB"]],"1f3fd":["1f469-1f3fd-200d-1f4bb",18,37,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDCBB"]],"1f3fe":["1f469-1f3fe-200d-1f4bb",18,38,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDCBB"]],"1f3ff":["1f469-1f3ff-200d-1f4bb",18,39,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDCBB"]]},
		"1f469-200d-1f4bc":{"1f3fb":["1f469-1f3fb-200d-1f4bc",18,41,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDCBC"]],"1f3fc":["1f469-1f3fc-200d-1f4bc",18,42,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDCBC"]],"1f3fd":["1f469-1f3fd-200d-1f4bc",18,43,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDCBC"]],"1f3fe":["1f469-1f3fe-200d-1f4bc",18,44,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDCBC"]],"1f3ff":["1f469-1f3ff-200d-1f4bc",18,45,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDCBC"]]},
		"1f469-200d-1f527":{"1f3fb":["1f469-1f3fb-200d-1f527",18,47,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDD27"]],"1f3fc":["1f469-1f3fc-200d-1f527",18,48,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDD27"]],"1f3fd":["1f469-1f3fd-200d-1f527",18,49,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDD27"]],"1f3fe":["1f469-1f3fe-200d-1f527",18,50,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDD27"]],"1f3ff":["1f469-1f3ff-200d-1f527",18,51,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDD27"]]},
		"1f469-200d-1f52c":{"1f3fb":["1f469-1f3fb-200d-1f52c",18,53,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDD2C"]],"1f3fc":["1f469-1f3fc-200d-1f52c",18,54,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDD2C"]],"1f3fd":["1f469-1f3fd-200d-1f52c",18,55,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDD2C"]],"1f3fe":["1f469-1f3fe-200d-1f52c",18,56,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDD2C"]],"1f3ff":["1f469-1f3ff-200d-1f52c",18,57,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDD2C"]]},
		"1f469-200d-1f680":{"1f3fb":["1f469-1f3fb-200d-1f680",18,59,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDE80"]],"1f3fc":["1f469-1f3fc-200d-1f680",19,0,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDE80"]],"1f3fd":["1f469-1f3fd-200d-1f680",19,1,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDE80"]],"1f3fe":["1f469-1f3fe-200d-1f680",19,2,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDE80"]],"1f3ff":["1f469-1f3ff-200d-1f680",19,3,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDE80"]]},
		"1f469-200d-1f692":{"1f3fb":["1f469-1f3fb-200d-1f692",19,5,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83D\uDE92"]],"1f3fc":["1f469-1f3fc-200d-1f692",19,6,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83D\uDE92"]],"1f3fd":["1f469-1f3fd-200d-1f692",19,7,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDE92"]],"1f3fe":["1f469-1f3fe-200d-1f692",19,8,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83D\uDE92"]],"1f3ff":["1f469-1f3ff-200d-1f692",19,9,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83D\uDE92"]]},
		"1f469-200d-1f9af":{"1f3fb":["1f469-1f3fb-200d-1f9af",19,11,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDAF"]],"1f3fc":["1f469-1f3fc-200d-1f9af",19,12,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDAF"]],"1f3fd":["1f469-1f3fd-200d-1f9af",19,13,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDAF"]],"1f3fe":["1f469-1f3fe-200d-1f9af",19,14,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDAF"]],"1f3ff":["1f469-1f3ff-200d-1f9af",19,15,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDAF"]]},
		"1f469-200d-1f9b0":{"1f3fb":["1f469-1f3fb-200d-1f9b0",19,17,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDB0"]],"1f3fc":["1f469-1f3fc-200d-1f9b0",19,18,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDB0"]],"1f3fd":["1f469-1f3fd-200d-1f9b0",19,19,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDB0"]],"1f3fe":["1f469-1f3fe-200d-1f9b0",19,20,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB0"]],"1f3ff":["1f469-1f3ff-200d-1f9b0",19,21,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDB0"]]},
		"1f469-200d-1f9b1":{"1f3fb":["1f469-1f3fb-200d-1f9b1",19,23,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDB1"]],"1f3fc":["1f469-1f3fc-200d-1f9b1",19,24,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDB1"]],"1f3fd":["1f469-1f3fd-200d-1f9b1",19,25,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDB1"]],"1f3fe":["1f469-1f3fe-200d-1f9b1",19,26,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB1"]],"1f3ff":["1f469-1f3ff-200d-1f9b1",19,27,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDB1"]]},
		"1f469-200d-1f9b2":{"1f3fb":["1f469-1f3fb-200d-1f9b2",19,29,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDB2"]],"1f3fc":["1f469-1f3fc-200d-1f9b2",19,30,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDB2"]],"1f3fd":["1f469-1f3fd-200d-1f9b2",19,31,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDB2"]],"1f3fe":["1f469-1f3fe-200d-1f9b2",19,32,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB2"]],"1f3ff":["1f469-1f3ff-200d-1f9b2",19,33,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDB2"]]},
		"1f469-200d-1f9b3":{"1f3fb":["1f469-1f3fb-200d-1f9b3",19,35,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDB3"]],"1f3fc":["1f469-1f3fc-200d-1f9b3",19,36,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDB3"]],"1f3fd":["1f469-1f3fd-200d-1f9b3",19,37,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDB3"]],"1f3fe":["1f469-1f3fe-200d-1f9b3",19,38,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB3"]],"1f3ff":["1f469-1f3ff-200d-1f9b3",19,39,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDB3"]]},
		"1f469-200d-1f9bc":{"1f3fb":["1f469-1f3fb-200d-1f9bc",19,41,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDBC"]],"1f3fc":["1f469-1f3fc-200d-1f9bc",19,42,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDBC"]],"1f3fd":["1f469-1f3fd-200d-1f9bc",19,43,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDBC"]],"1f3fe":["1f469-1f3fe-200d-1f9bc",19,44,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDBC"]],"1f3ff":["1f469-1f3ff-200d-1f9bc",19,45,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDBC"]]},
		"1f469-200d-1f9bd":{"1f3fb":["1f469-1f3fb-200d-1f9bd",19,47,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDBD"]],"1f3fc":["1f469-1f3fc-200d-1f9bd",19,48,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDDBD"]],"1f3fd":["1f469-1f3fd-200d-1f9bd",19,49,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDDBD"]],"1f3fe":["1f469-1f3fe-200d-1f9bd",19,50,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDBD"]],"1f3ff":["1f469-1f3ff-200d-1f9bd",19,51,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDBD"]]},
		"1f469-200d-2695-fe0f":{"1f3fb":["1f469-1f3fb-200d-2695-fe0f",19,53,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2695\uFE0F"]],"1f3fc":["1f469-1f3fc-200d-2695-fe0f",19,54,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2695\uFE0F"]],"1f3fd":["1f469-1f3fd-200d-2695-fe0f",19,55,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2695\uFE0F"]],"1f3fe":["1f469-1f3fe-200d-2695-fe0f",19,56,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2695\uFE0F"]],"1f3ff":["1f469-1f3ff-200d-2695-fe0f",19,57,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2695\uFE0F"]]},
		"1f469-200d-2696-fe0f":{"1f3fb":["1f469-1f3fb-200d-2696-fe0f",19,59,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2696\uFE0F"]],"1f3fc":["1f469-1f3fc-200d-2696-fe0f",20,0,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2696\uFE0F"]],"1f3fd":["1f469-1f3fd-200d-2696-fe0f",20,1,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2696\uFE0F"]],"1f3fe":["1f469-1f3fe-200d-2696-fe0f",20,2,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2696\uFE0F"]],"1f3ff":["1f469-1f3ff-200d-2696-fe0f",20,3,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2696\uFE0F"]]},
		"1f469-200d-2708-fe0f":{"1f3fb":["1f469-1f3fb-200d-2708-fe0f",20,5,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2708\uFE0F"]],"1f3fc":["1f469-1f3fc-200d-2708-fe0f",20,6,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2708\uFE0F"]],"1f3fd":["1f469-1f3fd-200d-2708-fe0f",20,7,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2708\uFE0F"]],"1f3fe":["1f469-1f3fe-200d-2708-fe0f",20,8,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2708\uFE0F"]],"1f3ff":["1f469-1f3ff-200d-2708-fe0f",20,9,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2708\uFE0F"]]},
		"1f469-200d-2764-fe0f-200d-1f468":{"1f3fb-1f3fb":["1f469-1f3fb-200d-2764-fe0f-200d-1f468-1f3fb",20,11,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-2764-fe0f-200d-1f468-1f3fc",20,12,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-2764-fe0f-200d-1f468-1f3fd",20,13,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-2764-fe0f-200d-1f468-1f3fe",20,14,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-2764-fe0f-200d-1f468-1f3ff",20,15,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-2764-fe0f-200d-1f468-1f3fb",20,16,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f469-1f3fc-200d-2764-fe0f-200d-1f468-1f3fc",20,17,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-2764-fe0f-200d-1f468-1f3fd",20,18,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-2764-fe0f-200d-1f468-1f3fe",20,19,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-2764-fe0f-200d-1f468-1f3ff",20,20,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-2764-fe0f-200d-1f468-1f3fb",20,21,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-2764-fe0f-200d-1f468-1f3fc",20,22,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f469-1f3fd-200d-2764-fe0f-200d-1f468-1f3fd",20,23,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-2764-fe0f-200d-1f468-1f3fe",20,24,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-2764-fe0f-200d-1f468-1f3ff",20,25,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-2764-fe0f-200d-1f468-1f3fb",20,26,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-2764-fe0f-200d-1f468-1f3fc",20,27,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-2764-fe0f-200d-1f468-1f3fd",20,28,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f469-1f3fe-200d-2764-fe0f-200d-1f468-1f3fe",20,29,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-2764-fe0f-200d-1f468-1f3ff",20,30,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-2764-fe0f-200d-1f468-1f3fb",20,31,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-2764-fe0f-200d-1f468-1f3fc",20,32,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-2764-fe0f-200d-1f468-1f3fd",20,33,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-2764-fe0f-200d-1f468-1f3fe",20,34,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f469-1f3ff-200d-2764-fe0f-200d-1f468-1f3ff",20,35,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC68\uD83C\uDFFF"]]},
		"1f469-200d-2764-fe0f-200d-1f469":{"1f3fb-1f3fb":["1f469-1f3fb-200d-2764-fe0f-200d-1f469-1f3fb",20,37,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-2764-fe0f-200d-1f469-1f3fc",20,38,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-2764-fe0f-200d-1f469-1f3fd",20,39,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-2764-fe0f-200d-1f469-1f3fe",20,40,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-2764-fe0f-200d-1f469-1f3ff",20,41,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-2764-fe0f-200d-1f469-1f3fb",20,42,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f469-1f3fc-200d-2764-fe0f-200d-1f469-1f3fc",20,43,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-2764-fe0f-200d-1f469-1f3fd",20,44,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-2764-fe0f-200d-1f469-1f3fe",20,45,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-2764-fe0f-200d-1f469-1f3ff",20,46,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-2764-fe0f-200d-1f469-1f3fb",20,47,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-2764-fe0f-200d-1f469-1f3fc",20,48,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f469-1f3fd-200d-2764-fe0f-200d-1f469-1f3fd",20,49,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-2764-fe0f-200d-1f469-1f3fe",20,50,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-2764-fe0f-200d-1f469-1f3ff",20,51,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-2764-fe0f-200d-1f469-1f3fb",20,52,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-2764-fe0f-200d-1f469-1f3fc",20,53,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-2764-fe0f-200d-1f469-1f3fd",20,54,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f469-1f3fe-200d-2764-fe0f-200d-1f469-1f3fe",20,55,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-2764-fe0f-200d-1f469-1f3ff",20,56,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-2764-fe0f-200d-1f469-1f3fb",20,57,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-2764-fe0f-200d-1f469-1f3fc",20,58,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-2764-fe0f-200d-1f469-1f3fd",20,59,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-2764-fe0f-200d-1f469-1f3fe",21,0,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f469-1f3ff-200d-2764-fe0f-200d-1f469-1f3ff",21,1,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC69\uD83C\uDFFF"]]},
		"1f469-200d-2764-fe0f-200d-1f48b-200d-1f468":{"1f3fb-1f3fb":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",21,3,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",21,4,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",21,5,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",21,6,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",21,7,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",21,8,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",21,9,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",21,10,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",21,11,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",21,12,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",21,13,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",21,14,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",21,15,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",21,16,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",21,17,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",21,18,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",21,19,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",21,20,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",21,21,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",21,22,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fb",21,23,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fc",21,24,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fd",21,25,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3fe",21,26,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f468-1f3ff",21,27,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC68\uD83C\uDFFF"]]},
		"1f469-200d-2764-fe0f-200d-1f48b-200d-1f469":{"1f3fb-1f3fb":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fb",21,29,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fc",21,30,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fd",21,31,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fe",21,32,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3ff",21,33,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fb",21,34,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fc",21,35,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fd",21,36,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fe",21,37,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3ff",21,38,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fb",21,39,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fc",21,40,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fd",21,41,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fe",21,42,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3ff",21,43,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fb",21,44,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fc",21,45,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fd",21,46,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fe",21,47,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3ff",21,48,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fb",21,49,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fc",21,50,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fd",21,51,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3fe",21,52,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f469-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f469-1f3ff",21,53,7,["\uD83D\uDC69\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83D\uDC69\uD83C\uDFFF"]]},
		"1f469":{"1f3fb":["1f469-1f3fb",21,55,15,["\uD83D\uDC69\uD83C\uDFFB"]],"1f3fc":["1f469-1f3fc",21,56,15,["\uD83D\uDC69\uD83C\uDFFC"]],"1f3fd":["1f469-1f3fd",21,57,15,["\uD83D\uDC69\uD83C\uDFFD"]],"1f3fe":["1f469-1f3fe",21,58,15,["\uD83D\uDC69\uD83C\uDFFE"]],"1f3ff":["1f469-1f3ff",21,59,15,["\uD83D\uDC69\uD83C\uDFFF"]]},
		"1f46b":{"1f3fb":["1f46b-1f3fb",22,2,15,["\uD83D\uDC6B\uD83C\uDFFB"]],"1f3fc":["1f46b-1f3fc",22,3,15,["\uD83D\uDC6B\uD83C\uDFFC"]],"1f3fd":["1f46b-1f3fd",22,4,15,["\uD83D\uDC6B\uD83C\uDFFD"]],"1f3fe":["1f46b-1f3fe",22,5,15,["\uD83D\uDC6B\uD83C\uDFFE"]],"1f3ff":["1f46b-1f3ff",22,6,15,["\uD83D\uDC6B\uD83C\uDFFF"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-1f91d-200d-1f468-1f3fc",22,7,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-1f91d-200d-1f468-1f3fd",22,8,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-1f91d-200d-1f468-1f3fe",22,9,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-1f91d-200d-1f468-1f3ff",22,10,15,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-1f91d-200d-1f468-1f3fb",22,11,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-1f91d-200d-1f468-1f3fd",22,12,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-1f91d-200d-1f468-1f3fe",22,13,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-1f91d-200d-1f468-1f3ff",22,14,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-1f91d-200d-1f468-1f3fb",22,15,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-1f91d-200d-1f468-1f3fc",22,16,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-1f91d-200d-1f468-1f3fe",22,17,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-1f91d-200d-1f468-1f3ff",22,18,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-1f91d-200d-1f468-1f3fb",22,19,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-1f91d-200d-1f468-1f3fc",22,20,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-1f91d-200d-1f468-1f3fd",22,21,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-1f91d-200d-1f468-1f3ff",22,22,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-1f91d-200d-1f468-1f3fb",22,23,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-1f91d-200d-1f468-1f3fc",22,24,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-1f91d-200d-1f468-1f3fd",22,25,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-1f91d-200d-1f468-1f3fe",22,26,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]]},
		"1f46c":{"1f3fb":["1f46c-1f3fb",22,28,15,["\uD83D\uDC6C\uD83C\uDFFB"]],"1f3fc":["1f46c-1f3fc",22,29,15,["\uD83D\uDC6C\uD83C\uDFFC"]],"1f3fd":["1f46c-1f3fd",22,30,15,["\uD83D\uDC6C\uD83C\uDFFD"]],"1f3fe":["1f46c-1f3fe",22,31,15,["\uD83D\uDC6C\uD83C\uDFFE"]],"1f3ff":["1f46c-1f3ff",22,32,15,["\uD83D\uDC6C\uD83C\uDFFF"]],"1f3fb-1f3fc":["1f468-1f3fb-200d-1f91d-200d-1f468-1f3fc",22,33,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f468-1f3fb-200d-1f91d-200d-1f468-1f3fd",22,34,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f468-1f3fb-200d-1f91d-200d-1f468-1f3fe",22,35,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f468-1f3fb-200d-1f91d-200d-1f468-1f3ff",22,36,7,["\uD83D\uDC68\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f468-1f3fc-200d-1f91d-200d-1f468-1f3fb",22,37,15,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fc-1f3fd":["1f468-1f3fc-200d-1f91d-200d-1f468-1f3fd",22,38,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f468-1f3fc-200d-1f91d-200d-1f468-1f3fe",22,39,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f468-1f3fc-200d-1f91d-200d-1f468-1f3ff",22,40,7,["\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f468-1f3fd-200d-1f91d-200d-1f468-1f3fb",22,41,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f468-1f3fd-200d-1f91d-200d-1f468-1f3fc",22,42,15,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fd-1f3fe":["1f468-1f3fd-200d-1f91d-200d-1f468-1f3fe",22,43,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f468-1f3fd-200d-1f91d-200d-1f468-1f3ff",22,44,7,["\uD83D\uDC68\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f468-1f3fe-200d-1f91d-200d-1f468-1f3fb",22,45,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f468-1f3fe-200d-1f91d-200d-1f468-1f3fc",22,46,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f468-1f3fe-200d-1f91d-200d-1f468-1f3fd",22,47,15,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3fe-1f3ff":["1f468-1f3fe-200d-1f91d-200d-1f468-1f3ff",22,48,7,["\uD83D\uDC68\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f468-1f3ff-200d-1f91d-200d-1f468-1f3fb",22,49,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f468-1f3ff-200d-1f91d-200d-1f468-1f3fc",22,50,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f468-1f3ff-200d-1f91d-200d-1f468-1f3fd",22,51,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f468-1f3ff-200d-1f91d-200d-1f468-1f3fe",22,52,15,["\uD83D\uDC68\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFE"]]},
		"1f46d":{"1f3fb":["1f46d-1f3fb",22,54,15,["\uD83D\uDC6D\uD83C\uDFFB"]],"1f3fc":["1f46d-1f3fc",22,55,15,["\uD83D\uDC6D\uD83C\uDFFC"]],"1f3fd":["1f46d-1f3fd",22,56,15,["\uD83D\uDC6D\uD83C\uDFFD"]],"1f3fe":["1f46d-1f3fe",22,57,15,["\uD83D\uDC6D\uD83C\uDFFE"]],"1f3ff":["1f46d-1f3ff",22,58,15,["\uD83D\uDC6D\uD83C\uDFFF"]],"1f3fb-1f3fc":["1f469-1f3fb-200d-1f91d-200d-1f469-1f3fc",22,59,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f469-1f3fb-200d-1f91d-200d-1f469-1f3fd",23,0,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f469-1f3fb-200d-1f91d-200d-1f469-1f3fe",23,1,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f469-1f3fb-200d-1f91d-200d-1f469-1f3ff",23,2,7,["\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f469-1f3fc-200d-1f91d-200d-1f469-1f3fb",23,3,15,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fc-1f3fd":["1f469-1f3fc-200d-1f91d-200d-1f469-1f3fd",23,4,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f469-1f3fc-200d-1f91d-200d-1f469-1f3fe",23,5,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f469-1f3fc-200d-1f91d-200d-1f469-1f3ff",23,6,7,["\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f469-1f3fd-200d-1f91d-200d-1f469-1f3fb",23,7,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f469-1f3fd-200d-1f91d-200d-1f469-1f3fc",23,8,15,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fd-1f3fe":["1f469-1f3fd-200d-1f91d-200d-1f469-1f3fe",23,9,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f469-1f3fd-200d-1f91d-200d-1f469-1f3ff",23,10,7,["\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f469-1f3fe-200d-1f91d-200d-1f469-1f3fb",23,11,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f469-1f3fe-200d-1f91d-200d-1f469-1f3fc",23,12,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f469-1f3fe-200d-1f91d-200d-1f469-1f3fd",23,13,15,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3fe-1f3ff":["1f469-1f3fe-200d-1f91d-200d-1f469-1f3ff",23,14,7,["\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f469-1f3ff-200d-1f91d-200d-1f469-1f3fb",23,15,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f469-1f3ff-200d-1f91d-200d-1f469-1f3fc",23,16,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f469-1f3ff-200d-1f91d-200d-1f469-1f3fd",23,17,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f469-1f3ff-200d-1f91d-200d-1f469-1f3fe",23,18,15,["\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83D\uDC69\uD83C\uDFFE"]]},
		"1f46e-200d-2640-fe0f":{"1f3fb":["1f46e-1f3fb-200d-2640-fe0f",23,20,15,["\uD83D\uDC6E\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f46e-1f3fc-200d-2640-fe0f",23,21,15,["\uD83D\uDC6E\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f46e-1f3fd-200d-2640-fe0f",23,22,15,["\uD83D\uDC6E\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f46e-1f3fe-200d-2640-fe0f",23,23,15,["\uD83D\uDC6E\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f46e-1f3ff-200d-2640-fe0f",23,24,15,["\uD83D\uDC6E\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f46e-200d-2642-fe0f":{"1f3fb":["1f46e-1f3fb-200d-2642-fe0f",23,26,15,["\uD83D\uDC6E\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDC6E\uD83C\uDFFB"]],"1f3fc":["1f46e-1f3fc-200d-2642-fe0f",23,27,15,["\uD83D\uDC6E\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDC6E\uD83C\uDFFC"]],"1f3fd":["1f46e-1f3fd-200d-2642-fe0f",23,28,15,["\uD83D\uDC6E\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDC6E\uD83C\uDFFD"]],"1f3fe":["1f46e-1f3fe-200d-2642-fe0f",23,29,15,["\uD83D\uDC6E\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDC6E\uD83C\uDFFE"]],"1f3ff":["1f46e-1f3ff-200d-2642-fe0f",23,30,15,["\uD83D\uDC6E\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDC6E\uD83C\uDFFF"]]},
		"1f470-200d-2640-fe0f":{"1f3fb":["1f470-1f3fb-200d-2640-fe0f",23,41,15,["\uD83D\uDC70\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f470-1f3fc-200d-2640-fe0f",23,42,15,["\uD83D\uDC70\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f470-1f3fd-200d-2640-fe0f",23,43,15,["\uD83D\uDC70\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f470-1f3fe-200d-2640-fe0f",23,44,15,["\uD83D\uDC70\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f470-1f3ff-200d-2640-fe0f",23,45,15,["\uD83D\uDC70\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f470-200d-2642-fe0f":{"1f3fb":["1f470-1f3fb-200d-2642-fe0f",23,47,15,["\uD83D\uDC70\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f470-1f3fc-200d-2642-fe0f",23,48,15,["\uD83D\uDC70\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f470-1f3fd-200d-2642-fe0f",23,49,15,["\uD83D\uDC70\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f470-1f3fe-200d-2642-fe0f",23,50,15,["\uD83D\uDC70\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f470-1f3ff-200d-2642-fe0f",23,51,15,["\uD83D\uDC70\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f470":{"1f3fb":["1f470-1f3fb",23,53,15,["\uD83D\uDC70\uD83C\uDFFB"]],"1f3fc":["1f470-1f3fc",23,54,15,["\uD83D\uDC70\uD83C\uDFFC"]],"1f3fd":["1f470-1f3fd",23,55,15,["\uD83D\uDC70\uD83C\uDFFD"]],"1f3fe":["1f470-1f3fe",23,56,15,["\uD83D\uDC70\uD83C\uDFFE"]],"1f3ff":["1f470-1f3ff",23,57,15,["\uD83D\uDC70\uD83C\uDFFF"]]},
		"1f471-200d-2640-fe0f":{"1f3fb":["1f471-1f3fb-200d-2640-fe0f",23,59,15,["\uD83D\uDC71\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f471-1f3fc-200d-2640-fe0f",24,0,15,["\uD83D\uDC71\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f471-1f3fd-200d-2640-fe0f",24,1,15,["\uD83D\uDC71\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f471-1f3fe-200d-2640-fe0f",24,2,15,["\uD83D\uDC71\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f471-1f3ff-200d-2640-fe0f",24,3,15,["\uD83D\uDC71\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f471-200d-2642-fe0f":{"1f3fb":["1f471-1f3fb-200d-2642-fe0f",24,5,15,["\uD83D\uDC71\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDC71\uD83C\uDFFB"]],"1f3fc":["1f471-1f3fc-200d-2642-fe0f",24,6,15,["\uD83D\uDC71\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDC71\uD83C\uDFFC"]],"1f3fd":["1f471-1f3fd-200d-2642-fe0f",24,7,15,["\uD83D\uDC71\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDC71\uD83C\uDFFD"]],"1f3fe":["1f471-1f3fe-200d-2642-fe0f",24,8,15,["\uD83D\uDC71\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDC71\uD83C\uDFFE"]],"1f3ff":["1f471-1f3ff-200d-2642-fe0f",24,9,15,["\uD83D\uDC71\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDC71\uD83C\uDFFF"]]},
		"1f472":{"1f3fb":["1f472-1f3fb",24,17,15,["\uD83D\uDC72\uD83C\uDFFB"]],"1f3fc":["1f472-1f3fc",24,18,15,["\uD83D\uDC72\uD83C\uDFFC"]],"1f3fd":["1f472-1f3fd",24,19,15,["\uD83D\uDC72\uD83C\uDFFD"]],"1f3fe":["1f472-1f3fe",24,20,15,["\uD83D\uDC72\uD83C\uDFFE"]],"1f3ff":["1f472-1f3ff",24,21,15,["\uD83D\uDC72\uD83C\uDFFF"]]},
		"1f473-200d-2640-fe0f":{"1f3fb":["1f473-1f3fb-200d-2640-fe0f",24,23,15,["\uD83D\uDC73\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f473-1f3fc-200d-2640-fe0f",24,24,15,["\uD83D\uDC73\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f473-1f3fd-200d-2640-fe0f",24,25,15,["\uD83D\uDC73\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f473-1f3fe-200d-2640-fe0f",24,26,15,["\uD83D\uDC73\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f473-1f3ff-200d-2640-fe0f",24,27,15,["\uD83D\uDC73\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f473-200d-2642-fe0f":{"1f3fb":["1f473-1f3fb-200d-2642-fe0f",24,29,15,["\uD83D\uDC73\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDC73\uD83C\uDFFB"]],"1f3fc":["1f473-1f3fc-200d-2642-fe0f",24,30,15,["\uD83D\uDC73\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDC73\uD83C\uDFFC"]],"1f3fd":["1f473-1f3fd-200d-2642-fe0f",24,31,15,["\uD83D\uDC73\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDC73\uD83C\uDFFD"]],"1f3fe":["1f473-1f3fe-200d-2642-fe0f",24,32,15,["\uD83D\uDC73\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDC73\uD83C\uDFFE"]],"1f3ff":["1f473-1f3ff-200d-2642-fe0f",24,33,15,["\uD83D\uDC73\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDC73\uD83C\uDFFF"]]},
		"1f474":{"1f3fb":["1f474-1f3fb",24,41,15,["\uD83D\uDC74\uD83C\uDFFB"]],"1f3fc":["1f474-1f3fc",24,42,15,["\uD83D\uDC74\uD83C\uDFFC"]],"1f3fd":["1f474-1f3fd",24,43,15,["\uD83D\uDC74\uD83C\uDFFD"]],"1f3fe":["1f474-1f3fe",24,44,15,["\uD83D\uDC74\uD83C\uDFFE"]],"1f3ff":["1f474-1f3ff",24,45,15,["\uD83D\uDC74\uD83C\uDFFF"]]},
		"1f475":{"1f3fb":["1f475-1f3fb",24,47,15,["\uD83D\uDC75\uD83C\uDFFB"]],"1f3fc":["1f475-1f3fc",24,48,15,["\uD83D\uDC75\uD83C\uDFFC"]],"1f3fd":["1f475-1f3fd",24,49,15,["\uD83D\uDC75\uD83C\uDFFD"]],"1f3fe":["1f475-1f3fe",24,50,15,["\uD83D\uDC75\uD83C\uDFFE"]],"1f3ff":["1f475-1f3ff",24,51,15,["\uD83D\uDC75\uD83C\uDFFF"]]},
		"1f476":{"1f3fb":["1f476-1f3fb",24,53,15,["\uD83D\uDC76\uD83C\uDFFB"]],"1f3fc":["1f476-1f3fc",24,54,15,["\uD83D\uDC76\uD83C\uDFFC"]],"1f3fd":["1f476-1f3fd",24,55,15,["\uD83D\uDC76\uD83C\uDFFD"]],"1f3fe":["1f476-1f3fe",24,56,15,["\uD83D\uDC76\uD83C\uDFFE"]],"1f3ff":["1f476-1f3ff",24,57,15,["\uD83D\uDC76\uD83C\uDFFF"]]},
		"1f477-200d-2640-fe0f":{"1f3fb":["1f477-1f3fb-200d-2640-fe0f",24,59,15,["\uD83D\uDC77\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f477-1f3fc-200d-2640-fe0f",25,0,15,["\uD83D\uDC77\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f477-1f3fd-200d-2640-fe0f",25,1,15,["\uD83D\uDC77\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f477-1f3fe-200d-2640-fe0f",25,2,15,["\uD83D\uDC77\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f477-1f3ff-200d-2640-fe0f",25,3,15,["\uD83D\uDC77\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f477-200d-2642-fe0f":{"1f3fb":["1f477-1f3fb-200d-2642-fe0f",25,5,15,["\uD83D\uDC77\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDC77\uD83C\uDFFB"]],"1f3fc":["1f477-1f3fc-200d-2642-fe0f",25,6,15,["\uD83D\uDC77\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDC77\uD83C\uDFFC"]],"1f3fd":["1f477-1f3fd-200d-2642-fe0f",25,7,15,["\uD83D\uDC77\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDC77\uD83C\uDFFD"]],"1f3fe":["1f477-1f3fe-200d-2642-fe0f",25,8,15,["\uD83D\uDC77\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDC77\uD83C\uDFFE"]],"1f3ff":["1f477-1f3ff-200d-2642-fe0f",25,9,15,["\uD83D\uDC77\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDC77\uD83C\uDFFF"]]},
		"1f478":{"1f3fb":["1f478-1f3fb",25,17,15,["\uD83D\uDC78\uD83C\uDFFB"]],"1f3fc":["1f478-1f3fc",25,18,15,["\uD83D\uDC78\uD83C\uDFFC"]],"1f3fd":["1f478-1f3fd",25,19,15,["\uD83D\uDC78\uD83C\uDFFD"]],"1f3fe":["1f478-1f3fe",25,20,15,["\uD83D\uDC78\uD83C\uDFFE"]],"1f3ff":["1f478-1f3ff",25,21,15,["\uD83D\uDC78\uD83C\uDFFF"]]},
		"1f47c":{"1f3fb":["1f47c-1f3fb",25,26,15,["\uD83D\uDC7C\uD83C\uDFFB"]],"1f3fc":["1f47c-1f3fc",25,27,15,["\uD83D\uDC7C\uD83C\uDFFC"]],"1f3fd":["1f47c-1f3fd",25,28,15,["\uD83D\uDC7C\uD83C\uDFFD"]],"1f3fe":["1f47c-1f3fe",25,29,15,["\uD83D\uDC7C\uD83C\uDFFE"]],"1f3ff":["1f47c-1f3ff",25,30,15,["\uD83D\uDC7C\uD83C\uDFFF"]]},
		"1f481-200d-2640-fe0f":{"1f3fb":["1f481-1f3fb-200d-2640-fe0f",25,36,15,["\uD83D\uDC81\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDC81\uD83C\uDFFB"]],"1f3fc":["1f481-1f3fc-200d-2640-fe0f",25,37,15,["\uD83D\uDC81\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDC81\uD83C\uDFFC"]],"1f3fd":["1f481-1f3fd-200d-2640-fe0f",25,38,15,["\uD83D\uDC81\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDC81\uD83C\uDFFD"]],"1f3fe":["1f481-1f3fe-200d-2640-fe0f",25,39,15,["\uD83D\uDC81\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDC81\uD83C\uDFFE"]],"1f3ff":["1f481-1f3ff-200d-2640-fe0f",25,40,15,["\uD83D\uDC81\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDC81\uD83C\uDFFF"]]},
		"1f481-200d-2642-fe0f":{"1f3fb":["1f481-1f3fb-200d-2642-fe0f",25,42,15,["\uD83D\uDC81\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f481-1f3fc-200d-2642-fe0f",25,43,15,["\uD83D\uDC81\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f481-1f3fd-200d-2642-fe0f",25,44,15,["\uD83D\uDC81\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f481-1f3fe-200d-2642-fe0f",25,45,15,["\uD83D\uDC81\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f481-1f3ff-200d-2642-fe0f",25,46,15,["\uD83D\uDC81\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f482-200d-2640-fe0f":{"1f3fb":["1f482-1f3fb-200d-2640-fe0f",25,54,15,["\uD83D\uDC82\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f482-1f3fc-200d-2640-fe0f",25,55,15,["\uD83D\uDC82\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f482-1f3fd-200d-2640-fe0f",25,56,15,["\uD83D\uDC82\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f482-1f3fe-200d-2640-fe0f",25,57,15,["\uD83D\uDC82\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f482-1f3ff-200d-2640-fe0f",25,58,15,["\uD83D\uDC82\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f482-200d-2642-fe0f":{"1f3fb":["1f482-1f3fb-200d-2642-fe0f",26,0,15,["\uD83D\uDC82\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDC82\uD83C\uDFFB"]],"1f3fc":["1f482-1f3fc-200d-2642-fe0f",26,1,15,["\uD83D\uDC82\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDC82\uD83C\uDFFC"]],"1f3fd":["1f482-1f3fd-200d-2642-fe0f",26,2,15,["\uD83D\uDC82\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDC82\uD83C\uDFFD"]],"1f3fe":["1f482-1f3fe-200d-2642-fe0f",26,3,15,["\uD83D\uDC82\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDC82\uD83C\uDFFE"]],"1f3ff":["1f482-1f3ff-200d-2642-fe0f",26,4,15,["\uD83D\uDC82\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDC82\uD83C\uDFFF"]]},
		"1f483":{"1f3fb":["1f483-1f3fb",26,12,15,["\uD83D\uDC83\uD83C\uDFFB"]],"1f3fc":["1f483-1f3fc",26,13,15,["\uD83D\uDC83\uD83C\uDFFC"]],"1f3fd":["1f483-1f3fd",26,14,15,["\uD83D\uDC83\uD83C\uDFFD"]],"1f3fe":["1f483-1f3fe",26,15,15,["\uD83D\uDC83\uD83C\uDFFE"]],"1f3ff":["1f483-1f3ff",26,16,15,["\uD83D\uDC83\uD83C\uDFFF"]]},
		"1f485":{"1f3fb":["1f485-1f3fb",26,19,15,["\uD83D\uDC85\uD83C\uDFFB"]],"1f3fc":["1f485-1f3fc",26,20,15,["\uD83D\uDC85\uD83C\uDFFC"]],"1f3fd":["1f485-1f3fd",26,21,15,["\uD83D\uDC85\uD83C\uDFFD"]],"1f3fe":["1f485-1f3fe",26,22,15,["\uD83D\uDC85\uD83C\uDFFE"]],"1f3ff":["1f485-1f3ff",26,23,15,["\uD83D\uDC85\uD83C\uDFFF"]]},
		"1f486-200d-2640-fe0f":{"1f3fb":["1f486-1f3fb-200d-2640-fe0f",26,25,15,["\uD83D\uDC86\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDC86\uD83C\uDFFB"]],"1f3fc":["1f486-1f3fc-200d-2640-fe0f",26,26,15,["\uD83D\uDC86\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDC86\uD83C\uDFFC"]],"1f3fd":["1f486-1f3fd-200d-2640-fe0f",26,27,15,["\uD83D\uDC86\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDC86\uD83C\uDFFD"]],"1f3fe":["1f486-1f3fe-200d-2640-fe0f",26,28,15,["\uD83D\uDC86\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDC86\uD83C\uDFFE"]],"1f3ff":["1f486-1f3ff-200d-2640-fe0f",26,29,15,["\uD83D\uDC86\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDC86\uD83C\uDFFF"]]},
		"1f486-200d-2642-fe0f":{"1f3fb":["1f486-1f3fb-200d-2642-fe0f",26,31,15,["\uD83D\uDC86\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f486-1f3fc-200d-2642-fe0f",26,32,15,["\uD83D\uDC86\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f486-1f3fd-200d-2642-fe0f",26,33,15,["\uD83D\uDC86\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f486-1f3fe-200d-2642-fe0f",26,34,15,["\uD83D\uDC86\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f486-1f3ff-200d-2642-fe0f",26,35,15,["\uD83D\uDC86\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f487-200d-2640-fe0f":{"1f3fb":["1f487-1f3fb-200d-2640-fe0f",26,43,15,["\uD83D\uDC87\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDC87\uD83C\uDFFB"]],"1f3fc":["1f487-1f3fc-200d-2640-fe0f",26,44,15,["\uD83D\uDC87\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDC87\uD83C\uDFFC"]],"1f3fd":["1f487-1f3fd-200d-2640-fe0f",26,45,15,["\uD83D\uDC87\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDC87\uD83C\uDFFD"]],"1f3fe":["1f487-1f3fe-200d-2640-fe0f",26,46,15,["\uD83D\uDC87\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDC87\uD83C\uDFFE"]],"1f3ff":["1f487-1f3ff-200d-2640-fe0f",26,47,15,["\uD83D\uDC87\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDC87\uD83C\uDFFF"]]},
		"1f487-200d-2642-fe0f":{"1f3fb":["1f487-1f3fb-200d-2642-fe0f",26,49,15,["\uD83D\uDC87\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f487-1f3fc-200d-2642-fe0f",26,50,15,["\uD83D\uDC87\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f487-1f3fd-200d-2642-fe0f",26,51,15,["\uD83D\uDC87\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f487-1f3fe-200d-2642-fe0f",26,52,15,["\uD83D\uDC87\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f487-1f3ff-200d-2642-fe0f",26,53,15,["\uD83D\uDC87\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f48f":{"1f3fb":["1f48f-1f3fb",27,8,15,["\uD83D\uDC8F\uD83C\uDFFB"]],"1f3fc":["1f48f-1f3fc",27,9,15,["\uD83D\uDC8F\uD83C\uDFFC"]],"1f3fd":["1f48f-1f3fd",27,10,15,["\uD83D\uDC8F\uD83C\uDFFD"]],"1f3fe":["1f48f-1f3fe",27,11,15,["\uD83D\uDC8F\uD83C\uDFFE"]],"1f3ff":["1f48f-1f3ff",27,12,15,["\uD83D\uDC8F\uD83C\uDFFF"]],"1f3fb-1f3fc":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fc",27,13,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fd",27,14,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fe",27,15,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3ff",27,16,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fb",27,17,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fc-1f3fd":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fd",27,18,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fe",27,19,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3ff",27,20,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fb",27,21,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fc",27,22,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fd-1f3fe":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fe",27,23,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3ff",27,24,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fb",27,25,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fc",27,26,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fd",27,27,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fe-1f3ff":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3ff",27,28,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fb",27,29,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fc",27,30,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fd",27,31,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f48b-200d-1f9d1-1f3fe",27,32,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83D\uDC8B\u200D\uD83E\uDDD1\uD83C\uDFFE"]]},
		"1f491":{"1f3fb":["1f491-1f3fb",27,35,15,["\uD83D\uDC91\uD83C\uDFFB"]],"1f3fc":["1f491-1f3fc",27,36,15,["\uD83D\uDC91\uD83C\uDFFC"]],"1f3fd":["1f491-1f3fd",27,37,15,["\uD83D\uDC91\uD83C\uDFFD"]],"1f3fe":["1f491-1f3fe",27,38,15,["\uD83D\uDC91\uD83C\uDFFE"]],"1f3ff":["1f491-1f3ff",27,39,15,["\uD83D\uDC91\uD83C\uDFFF"]],"1f3fb-1f3fc":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f9d1-1f3fc",27,40,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f9d1-1f3fd",27,41,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f9d1-1f3fe",27,42,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f9d1-1f3fb-200d-2764-fe0f-200d-1f9d1-1f3ff",27,43,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f9d1-1f3fb",27,44,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fc-1f3fd":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f9d1-1f3fd",27,45,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f9d1-1f3fe",27,46,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f9d1-1f3fc-200d-2764-fe0f-200d-1f9d1-1f3ff",27,47,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f9d1-1f3fb",27,48,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f9d1-1f3fc",27,49,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fd-1f3fe":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f9d1-1f3fe",27,50,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f9d1-1f3fd-200d-2764-fe0f-200d-1f9d1-1f3ff",27,51,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f9d1-1f3fb",27,52,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f9d1-1f3fc",27,53,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f9d1-1f3fd",27,54,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fe-1f3ff":["1f9d1-1f3fe-200d-2764-fe0f-200d-1f9d1-1f3ff",27,55,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f9d1-1f3fb",27,56,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f9d1-1f3fc",27,57,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f9d1-1f3fd",27,58,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f9d1-1f3ff-200d-2764-fe0f-200d-1f9d1-1f3fe",27,59,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D\uD83E\uDDD1\uD83C\uDFFE"]]},
		"1f4aa":{"1f3fb":["1f4aa-1f3fb",28,25,15,["\uD83D\uDCAA\uD83C\uDFFB"]],"1f3fc":["1f4aa-1f3fc",28,26,15,["\uD83D\uDCAA\uD83C\uDFFC"]],"1f3fd":["1f4aa-1f3fd",28,27,15,["\uD83D\uDCAA\uD83C\uDFFD"]],"1f3fe":["1f4aa-1f3fe",28,28,15,["\uD83D\uDCAA\uD83C\uDFFE"]],"1f3ff":["1f4aa-1f3ff",28,29,15,["\uD83D\uDCAA\uD83C\uDFFF"]]},
		"1f574-fe0f":{"1f3fb":["1f574-1f3fb",31,30,15,["\uD83D\uDD74\uD83C\uDFFB"]],"1f3fc":["1f574-1f3fc",31,31,15,["\uD83D\uDD74\uD83C\uDFFC"]],"1f3fd":["1f574-1f3fd",31,32,15,["\uD83D\uDD74\uD83C\uDFFD"]],"1f3fe":["1f574-1f3fe",31,33,15,["\uD83D\uDD74\uD83C\uDFFE"]],"1f3ff":["1f574-1f3ff",31,34,15,["\uD83D\uDD74\uD83C\uDFFF"]]},
		"1f575-fe0f-200d-2640-fe0f":{"1f3fb":["1f575-1f3fb-200d-2640-fe0f",31,36,15,["\uD83D\uDD75\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f575-1f3fc-200d-2640-fe0f",31,37,15,["\uD83D\uDD75\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f575-1f3fd-200d-2640-fe0f",31,38,15,["\uD83D\uDD75\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f575-1f3fe-200d-2640-fe0f",31,39,15,["\uD83D\uDD75\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f575-1f3ff-200d-2640-fe0f",31,40,15,["\uD83D\uDD75\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f575-fe0f-200d-2642-fe0f":{"1f3fb":["1f575-1f3fb-200d-2642-fe0f",31,42,15,["\uD83D\uDD75\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDD75\uD83C\uDFFB"]],"1f3fc":["1f575-1f3fc-200d-2642-fe0f",31,43,15,["\uD83D\uDD75\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDD75\uD83C\uDFFC"]],"1f3fd":["1f575-1f3fd-200d-2642-fe0f",31,44,15,["\uD83D\uDD75\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDD75\uD83C\uDFFD"]],"1f3fe":["1f575-1f3fe-200d-2642-fe0f",31,45,15,["\uD83D\uDD75\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDD75\uD83C\uDFFE"]],"1f3ff":["1f575-1f3ff-200d-2642-fe0f",31,46,15,["\uD83D\uDD75\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDD75\uD83C\uDFFF"]]},
		"1f57a":{"1f3fb":["1f57a-1f3fb",31,58,15,["\uD83D\uDD7A\uD83C\uDFFB"]],"1f3fc":["1f57a-1f3fc",31,59,15,["\uD83D\uDD7A\uD83C\uDFFC"]],"1f3fd":["1f57a-1f3fd",32,0,15,["\uD83D\uDD7A\uD83C\uDFFD"]],"1f3fe":["1f57a-1f3fe",32,1,15,["\uD83D\uDD7A\uD83C\uDFFE"]],"1f3ff":["1f57a-1f3ff",32,2,15,["\uD83D\uDD7A\uD83C\uDFFF"]]},
		"1f590-fe0f":{"1f3fb":["1f590-1f3fb",32,9,15,["\uD83D\uDD90\uD83C\uDFFB"]],"1f3fc":["1f590-1f3fc",32,10,15,["\uD83D\uDD90\uD83C\uDFFC"]],"1f3fd":["1f590-1f3fd",32,11,15,["\uD83D\uDD90\uD83C\uDFFD"]],"1f3fe":["1f590-1f3fe",32,12,15,["\uD83D\uDD90\uD83C\uDFFE"]],"1f3ff":["1f590-1f3ff",32,13,15,["\uD83D\uDD90\uD83C\uDFFF"]]},
		"1f595":{"1f3fb":["1f595-1f3fb",32,15,15,["\uD83D\uDD95\uD83C\uDFFB"]],"1f3fc":["1f595-1f3fc",32,16,15,["\uD83D\uDD95\uD83C\uDFFC"]],"1f3fd":["1f595-1f3fd",32,17,15,["\uD83D\uDD95\uD83C\uDFFD"]],"1f3fe":["1f595-1f3fe",32,18,15,["\uD83D\uDD95\uD83C\uDFFE"]],"1f3ff":["1f595-1f3ff",32,19,15,["\uD83D\uDD95\uD83C\uDFFF"]]},
		"1f596":{"1f3fb":["1f596-1f3fb",32,21,15,["\uD83D\uDD96\uD83C\uDFFB"]],"1f3fc":["1f596-1f3fc",32,22,15,["\uD83D\uDD96\uD83C\uDFFC"]],"1f3fd":["1f596-1f3fd",32,23,15,["\uD83D\uDD96\uD83C\uDFFD"]],"1f3fe":["1f596-1f3fe",32,24,15,["\uD83D\uDD96\uD83C\uDFFE"]],"1f3ff":["1f596-1f3ff",32,25,15,["\uD83D\uDD96\uD83C\uDFFF"]]},
		"1f645-200d-2640-fe0f":{"1f3fb":["1f645-1f3fb-200d-2640-fe0f",34,5,15,["\uD83D\uDE45\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDE45\uD83C\uDFFB"]],"1f3fc":["1f645-1f3fc-200d-2640-fe0f",34,6,15,["\uD83D\uDE45\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDE45\uD83C\uDFFC"]],"1f3fd":["1f645-1f3fd-200d-2640-fe0f",34,7,15,["\uD83D\uDE45\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDE45\uD83C\uDFFD"]],"1f3fe":["1f645-1f3fe-200d-2640-fe0f",34,8,15,["\uD83D\uDE45\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDE45\uD83C\uDFFE"]],"1f3ff":["1f645-1f3ff-200d-2640-fe0f",34,9,15,["\uD83D\uDE45\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDE45\uD83C\uDFFF"]]},
		"1f645-200d-2642-fe0f":{"1f3fb":["1f645-1f3fb-200d-2642-fe0f",34,11,15,["\uD83D\uDE45\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f645-1f3fc-200d-2642-fe0f",34,12,15,["\uD83D\uDE45\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f645-1f3fd-200d-2642-fe0f",34,13,15,["\uD83D\uDE45\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f645-1f3fe-200d-2642-fe0f",34,14,15,["\uD83D\uDE45\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f645-1f3ff-200d-2642-fe0f",34,15,15,["\uD83D\uDE45\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f646-200d-2640-fe0f":{"1f3fb":["1f646-1f3fb-200d-2640-fe0f",34,23,15,["\uD83D\uDE46\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDE46\uD83C\uDFFB"]],"1f3fc":["1f646-1f3fc-200d-2640-fe0f",34,24,15,["\uD83D\uDE46\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDE46\uD83C\uDFFC"]],"1f3fd":["1f646-1f3fd-200d-2640-fe0f",34,25,15,["\uD83D\uDE46\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDE46\uD83C\uDFFD"]],"1f3fe":["1f646-1f3fe-200d-2640-fe0f",34,26,15,["\uD83D\uDE46\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDE46\uD83C\uDFFE"]],"1f3ff":["1f646-1f3ff-200d-2640-fe0f",34,27,15,["\uD83D\uDE46\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDE46\uD83C\uDFFF"]]},
		"1f646-200d-2642-fe0f":{"1f3fb":["1f646-1f3fb-200d-2642-fe0f",34,29,15,["\uD83D\uDE46\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f646-1f3fc-200d-2642-fe0f",34,30,15,["\uD83D\uDE46\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f646-1f3fd-200d-2642-fe0f",34,31,15,["\uD83D\uDE46\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f646-1f3fe-200d-2642-fe0f",34,32,15,["\uD83D\uDE46\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f646-1f3ff-200d-2642-fe0f",34,33,15,["\uD83D\uDE46\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f647-200d-2640-fe0f":{"1f3fb":["1f647-1f3fb-200d-2640-fe0f",34,41,15,["\uD83D\uDE47\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f647-1f3fc-200d-2640-fe0f",34,42,15,["\uD83D\uDE47\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f647-1f3fd-200d-2640-fe0f",34,43,15,["\uD83D\uDE47\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f647-1f3fe-200d-2640-fe0f",34,44,15,["\uD83D\uDE47\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f647-1f3ff-200d-2640-fe0f",34,45,15,["\uD83D\uDE47\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f647-200d-2642-fe0f":{"1f3fb":["1f647-1f3fb-200d-2642-fe0f",34,47,15,["\uD83D\uDE47\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDE47\uD83C\uDFFB"]],"1f3fc":["1f647-1f3fc-200d-2642-fe0f",34,48,15,["\uD83D\uDE47\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDE47\uD83C\uDFFC"]],"1f3fd":["1f647-1f3fd-200d-2642-fe0f",34,49,15,["\uD83D\uDE47\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDE47\uD83C\uDFFD"]],"1f3fe":["1f647-1f3fe-200d-2642-fe0f",34,50,15,["\uD83D\uDE47\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDE47\uD83C\uDFFE"]],"1f3ff":["1f647-1f3ff-200d-2642-fe0f",34,51,15,["\uD83D\uDE47\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDE47\uD83C\uDFFF"]]},
		"1f64b-200d-2640-fe0f":{"1f3fb":["1f64b-1f3fb-200d-2640-fe0f",35,2,15,["\uD83D\uDE4B\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDE4B\uD83C\uDFFB"]],"1f3fc":["1f64b-1f3fc-200d-2640-fe0f",35,3,15,["\uD83D\uDE4B\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDE4B\uD83C\uDFFC"]],"1f3fd":["1f64b-1f3fd-200d-2640-fe0f",35,4,15,["\uD83D\uDE4B\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDE4B\uD83C\uDFFD"]],"1f3fe":["1f64b-1f3fe-200d-2640-fe0f",35,5,15,["\uD83D\uDE4B\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDE4B\uD83C\uDFFE"]],"1f3ff":["1f64b-1f3ff-200d-2640-fe0f",35,6,15,["\uD83D\uDE4B\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDE4B\uD83C\uDFFF"]]},
		"1f64b-200d-2642-fe0f":{"1f3fb":["1f64b-1f3fb-200d-2642-fe0f",35,8,15,["\uD83D\uDE4B\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f64b-1f3fc-200d-2642-fe0f",35,9,15,["\uD83D\uDE4B\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f64b-1f3fd-200d-2642-fe0f",35,10,15,["\uD83D\uDE4B\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f64b-1f3fe-200d-2642-fe0f",35,11,15,["\uD83D\uDE4B\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f64b-1f3ff-200d-2642-fe0f",35,12,15,["\uD83D\uDE4B\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f64c":{"1f3fb":["1f64c-1f3fb",35,20,15,["\uD83D\uDE4C\uD83C\uDFFB"]],"1f3fc":["1f64c-1f3fc",35,21,15,["\uD83D\uDE4C\uD83C\uDFFC"]],"1f3fd":["1f64c-1f3fd",35,22,15,["\uD83D\uDE4C\uD83C\uDFFD"]],"1f3fe":["1f64c-1f3fe",35,23,15,["\uD83D\uDE4C\uD83C\uDFFE"]],"1f3ff":["1f64c-1f3ff",35,24,15,["\uD83D\uDE4C\uD83C\uDFFF"]]},
		"1f64d-200d-2640-fe0f":{"1f3fb":["1f64d-1f3fb-200d-2640-fe0f",35,26,15,["\uD83D\uDE4D\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDE4D\uD83C\uDFFB"]],"1f3fc":["1f64d-1f3fc-200d-2640-fe0f",35,27,15,["\uD83D\uDE4D\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDE4D\uD83C\uDFFC"]],"1f3fd":["1f64d-1f3fd-200d-2640-fe0f",35,28,15,["\uD83D\uDE4D\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDE4D\uD83C\uDFFD"]],"1f3fe":["1f64d-1f3fe-200d-2640-fe0f",35,29,15,["\uD83D\uDE4D\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDE4D\uD83C\uDFFE"]],"1f3ff":["1f64d-1f3ff-200d-2640-fe0f",35,30,15,["\uD83D\uDE4D\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDE4D\uD83C\uDFFF"]]},
		"1f64d-200d-2642-fe0f":{"1f3fb":["1f64d-1f3fb-200d-2642-fe0f",35,32,15,["\uD83D\uDE4D\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f64d-1f3fc-200d-2642-fe0f",35,33,15,["\uD83D\uDE4D\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f64d-1f3fd-200d-2642-fe0f",35,34,15,["\uD83D\uDE4D\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f64d-1f3fe-200d-2642-fe0f",35,35,15,["\uD83D\uDE4D\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f64d-1f3ff-200d-2642-fe0f",35,36,15,["\uD83D\uDE4D\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f64e-200d-2640-fe0f":{"1f3fb":["1f64e-1f3fb-200d-2640-fe0f",35,44,15,["\uD83D\uDE4E\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83D\uDE4E\uD83C\uDFFB"]],"1f3fc":["1f64e-1f3fc-200d-2640-fe0f",35,45,15,["\uD83D\uDE4E\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83D\uDE4E\uD83C\uDFFC"]],"1f3fd":["1f64e-1f3fd-200d-2640-fe0f",35,46,15,["\uD83D\uDE4E\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83D\uDE4E\uD83C\uDFFD"]],"1f3fe":["1f64e-1f3fe-200d-2640-fe0f",35,47,15,["\uD83D\uDE4E\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83D\uDE4E\uD83C\uDFFE"]],"1f3ff":["1f64e-1f3ff-200d-2640-fe0f",35,48,15,["\uD83D\uDE4E\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83D\uDE4E\uD83C\uDFFF"]]},
		"1f64e-200d-2642-fe0f":{"1f3fb":["1f64e-1f3fb-200d-2642-fe0f",35,50,15,["\uD83D\uDE4E\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f64e-1f3fc-200d-2642-fe0f",35,51,15,["\uD83D\uDE4E\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f64e-1f3fd-200d-2642-fe0f",35,52,15,["\uD83D\uDE4E\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f64e-1f3fe-200d-2642-fe0f",35,53,15,["\uD83D\uDE4E\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f64e-1f3ff-200d-2642-fe0f",35,54,15,["\uD83D\uDE4E\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f64f":{"1f3fb":["1f64f-1f3fb",36,2,15,["\uD83D\uDE4F\uD83C\uDFFB"]],"1f3fc":["1f64f-1f3fc",36,3,15,["\uD83D\uDE4F\uD83C\uDFFC"]],"1f3fd":["1f64f-1f3fd",36,4,15,["\uD83D\uDE4F\uD83C\uDFFD"]],"1f3fe":["1f64f-1f3fe",36,5,15,["\uD83D\uDE4F\uD83C\uDFFE"]],"1f3ff":["1f64f-1f3ff",36,6,15,["\uD83D\uDE4F\uD83C\uDFFF"]]},
		"1f6a3-200d-2640-fe0f":{"1f3fb":["1f6a3-1f3fb-200d-2640-fe0f",36,43,15,["\uD83D\uDEA3\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f6a3-1f3fc-200d-2640-fe0f",36,44,15,["\uD83D\uDEA3\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f6a3-1f3fd-200d-2640-fe0f",36,45,15,["\uD83D\uDEA3\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f6a3-1f3fe-200d-2640-fe0f",36,46,15,["\uD83D\uDEA3\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f6a3-1f3ff-200d-2640-fe0f",36,47,15,["\uD83D\uDEA3\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f6a3-200d-2642-fe0f":{"1f3fb":["1f6a3-1f3fb-200d-2642-fe0f",36,49,15,["\uD83D\uDEA3\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDEA3\uD83C\uDFFB"]],"1f3fc":["1f6a3-1f3fc-200d-2642-fe0f",36,50,15,["\uD83D\uDEA3\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDEA3\uD83C\uDFFC"]],"1f3fd":["1f6a3-1f3fd-200d-2642-fe0f",36,51,15,["\uD83D\uDEA3\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDEA3\uD83C\uDFFD"]],"1f3fe":["1f6a3-1f3fe-200d-2642-fe0f",36,52,15,["\uD83D\uDEA3\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDEA3\uD83C\uDFFE"]],"1f3ff":["1f6a3-1f3ff-200d-2642-fe0f",36,53,15,["\uD83D\uDEA3\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDEA3\uD83C\uDFFF"]]},
		"1f6b4-200d-2640-fe0f":{"1f3fb":["1f6b4-1f3fb-200d-2640-fe0f",37,17,15,["\uD83D\uDEB4\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f6b4-1f3fc-200d-2640-fe0f",37,18,15,["\uD83D\uDEB4\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f6b4-1f3fd-200d-2640-fe0f",37,19,15,["\uD83D\uDEB4\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f6b4-1f3fe-200d-2640-fe0f",37,20,15,["\uD83D\uDEB4\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f6b4-1f3ff-200d-2640-fe0f",37,21,15,["\uD83D\uDEB4\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f6b4-200d-2642-fe0f":{"1f3fb":["1f6b4-1f3fb-200d-2642-fe0f",37,23,15,["\uD83D\uDEB4\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDEB4\uD83C\uDFFB"]],"1f3fc":["1f6b4-1f3fc-200d-2642-fe0f",37,24,15,["\uD83D\uDEB4\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDEB4\uD83C\uDFFC"]],"1f3fd":["1f6b4-1f3fd-200d-2642-fe0f",37,25,15,["\uD83D\uDEB4\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDEB4\uD83C\uDFFD"]],"1f3fe":["1f6b4-1f3fe-200d-2642-fe0f",37,26,15,["\uD83D\uDEB4\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDEB4\uD83C\uDFFE"]],"1f3ff":["1f6b4-1f3ff-200d-2642-fe0f",37,27,15,["\uD83D\uDEB4\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDEB4\uD83C\uDFFF"]]},
		"1f6b5-200d-2640-fe0f":{"1f3fb":["1f6b5-1f3fb-200d-2640-fe0f",37,35,15,["\uD83D\uDEB5\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f6b5-1f3fc-200d-2640-fe0f",37,36,15,["\uD83D\uDEB5\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f6b5-1f3fd-200d-2640-fe0f",37,37,15,["\uD83D\uDEB5\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f6b5-1f3fe-200d-2640-fe0f",37,38,15,["\uD83D\uDEB5\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f6b5-1f3ff-200d-2640-fe0f",37,39,15,["\uD83D\uDEB5\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f6b5-200d-2642-fe0f":{"1f3fb":["1f6b5-1f3fb-200d-2642-fe0f",37,41,15,["\uD83D\uDEB5\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDEB5\uD83C\uDFFB"]],"1f3fc":["1f6b5-1f3fc-200d-2642-fe0f",37,42,15,["\uD83D\uDEB5\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDEB5\uD83C\uDFFC"]],"1f3fd":["1f6b5-1f3fd-200d-2642-fe0f",37,43,15,["\uD83D\uDEB5\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDEB5\uD83C\uDFFD"]],"1f3fe":["1f6b5-1f3fe-200d-2642-fe0f",37,44,15,["\uD83D\uDEB5\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDEB5\uD83C\uDFFE"]],"1f3ff":["1f6b5-1f3ff-200d-2642-fe0f",37,45,15,["\uD83D\uDEB5\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDEB5\uD83C\uDFFF"]]},
		"1f6b6-200d-2640-fe0f":{"1f3fb":["1f6b6-1f3fb-200d-2640-fe0f",37,53,15,["\uD83D\uDEB6\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f6b6-1f3fc-200d-2640-fe0f",37,54,15,["\uD83D\uDEB6\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f6b6-1f3fd-200d-2640-fe0f",37,55,15,["\uD83D\uDEB6\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f6b6-1f3fe-200d-2640-fe0f",37,56,15,["\uD83D\uDEB6\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f6b6-1f3ff-200d-2640-fe0f",37,57,15,["\uD83D\uDEB6\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f6b6-200d-2642-fe0f":{"1f3fb":["1f6b6-1f3fb-200d-2642-fe0f",37,59,15,["\uD83D\uDEB6\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83D\uDEB6\uD83C\uDFFB"]],"1f3fc":["1f6b6-1f3fc-200d-2642-fe0f",38,0,15,["\uD83D\uDEB6\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83D\uDEB6\uD83C\uDFFC"]],"1f3fd":["1f6b6-1f3fd-200d-2642-fe0f",38,1,15,["\uD83D\uDEB6\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83D\uDEB6\uD83C\uDFFD"]],"1f3fe":["1f6b6-1f3fe-200d-2642-fe0f",38,2,15,["\uD83D\uDEB6\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83D\uDEB6\uD83C\uDFFE"]],"1f3ff":["1f6b6-1f3ff-200d-2642-fe0f",38,3,15,["\uD83D\uDEB6\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83D\uDEB6\uD83C\uDFFF"]]},
		"1f6c0":{"1f3fb":["1f6c0-1f3fb",38,20,15,["\uD83D\uDEC0\uD83C\uDFFB"]],"1f3fc":["1f6c0-1f3fc",38,21,15,["\uD83D\uDEC0\uD83C\uDFFC"]],"1f3fd":["1f6c0-1f3fd",38,22,15,["\uD83D\uDEC0\uD83C\uDFFD"]],"1f3fe":["1f6c0-1f3fe",38,23,15,["\uD83D\uDEC0\uD83C\uDFFE"]],"1f3ff":["1f6c0-1f3ff",38,24,15,["\uD83D\uDEC0\uD83C\uDFFF"]]},
		"1f6cc":{"1f3fb":["1f6cc-1f3fb",38,32,15,["\uD83D\uDECC\uD83C\uDFFB"]],"1f3fc":["1f6cc-1f3fc",38,33,15,["\uD83D\uDECC\uD83C\uDFFC"]],"1f3fd":["1f6cc-1f3fd",38,34,15,["\uD83D\uDECC\uD83C\uDFFD"]],"1f3fe":["1f6cc-1f3fe",38,35,15,["\uD83D\uDECC\uD83C\uDFFE"]],"1f3ff":["1f6cc-1f3ff",38,36,15,["\uD83D\uDECC\uD83C\uDFFF"]]},
		"1f90c":{"1f3fb":["1f90c-1f3fb",39,19,15,["\uD83E\uDD0C\uD83C\uDFFB"]],"1f3fc":["1f90c-1f3fc",39,20,15,["\uD83E\uDD0C\uD83C\uDFFC"]],"1f3fd":["1f90c-1f3fd",39,21,15,["\uD83E\uDD0C\uD83C\uDFFD"]],"1f3fe":["1f90c-1f3fe",39,22,15,["\uD83E\uDD0C\uD83C\uDFFE"]],"1f3ff":["1f90c-1f3ff",39,23,15,["\uD83E\uDD0C\uD83C\uDFFF"]]},
		"1f90f":{"1f3fb":["1f90f-1f3fb",39,27,15,["\uD83E\uDD0F\uD83C\uDFFB"]],"1f3fc":["1f90f-1f3fc",39,28,15,["\uD83E\uDD0F\uD83C\uDFFC"]],"1f3fd":["1f90f-1f3fd",39,29,15,["\uD83E\uDD0F\uD83C\uDFFD"]],"1f3fe":["1f90f-1f3fe",39,30,15,["\uD83E\uDD0F\uD83C\uDFFE"]],"1f3ff":["1f90f-1f3ff",39,31,15,["\uD83E\uDD0F\uD83C\uDFFF"]]},
		"1f918":{"1f3fb":["1f918-1f3fb",39,41,15,["\uD83E\uDD18\uD83C\uDFFB"]],"1f3fc":["1f918-1f3fc",39,42,15,["\uD83E\uDD18\uD83C\uDFFC"]],"1f3fd":["1f918-1f3fd",39,43,15,["\uD83E\uDD18\uD83C\uDFFD"]],"1f3fe":["1f918-1f3fe",39,44,15,["\uD83E\uDD18\uD83C\uDFFE"]],"1f3ff":["1f918-1f3ff",39,45,15,["\uD83E\uDD18\uD83C\uDFFF"]]},
		"1f919":{"1f3fb":["1f919-1f3fb",39,47,15,["\uD83E\uDD19\uD83C\uDFFB"]],"1f3fc":["1f919-1f3fc",39,48,15,["\uD83E\uDD19\uD83C\uDFFC"]],"1f3fd":["1f919-1f3fd",39,49,15,["\uD83E\uDD19\uD83C\uDFFD"]],"1f3fe":["1f919-1f3fe",39,50,15,["\uD83E\uDD19\uD83C\uDFFE"]],"1f3ff":["1f919-1f3ff",39,51,15,["\uD83E\uDD19\uD83C\uDFFF"]]},
		"1f91a":{"1f3fb":["1f91a-1f3fb",39,53,15,["\uD83E\uDD1A\uD83C\uDFFB"]],"1f3fc":["1f91a-1f3fc",39,54,15,["\uD83E\uDD1A\uD83C\uDFFC"]],"1f3fd":["1f91a-1f3fd",39,55,15,["\uD83E\uDD1A\uD83C\uDFFD"]],"1f3fe":["1f91a-1f3fe",39,56,15,["\uD83E\uDD1A\uD83C\uDFFE"]],"1f3ff":["1f91a-1f3ff",39,57,15,["\uD83E\uDD1A\uD83C\uDFFF"]]},
		"1f91b":{"1f3fb":["1f91b-1f3fb",39,59,15,["\uD83E\uDD1B\uD83C\uDFFB"]],"1f3fc":["1f91b-1f3fc",40,0,15,["\uD83E\uDD1B\uD83C\uDFFC"]],"1f3fd":["1f91b-1f3fd",40,1,15,["\uD83E\uDD1B\uD83C\uDFFD"]],"1f3fe":["1f91b-1f3fe",40,2,15,["\uD83E\uDD1B\uD83C\uDFFE"]],"1f3ff":["1f91b-1f3ff",40,3,15,["\uD83E\uDD1B\uD83C\uDFFF"]]},
		"1f91c":{"1f3fb":["1f91c-1f3fb",40,5,15,["\uD83E\uDD1C\uD83C\uDFFB"]],"1f3fc":["1f91c-1f3fc",40,6,15,["\uD83E\uDD1C\uD83C\uDFFC"]],"1f3fd":["1f91c-1f3fd",40,7,15,["\uD83E\uDD1C\uD83C\uDFFD"]],"1f3fe":["1f91c-1f3fe",40,8,15,["\uD83E\uDD1C\uD83C\uDFFE"]],"1f3ff":["1f91c-1f3ff",40,9,15,["\uD83E\uDD1C\uD83C\uDFFF"]]},
		"1f91e":{"1f3fb":["1f91e-1f3fb",40,12,15,["\uD83E\uDD1E\uD83C\uDFFB"]],"1f3fc":["1f91e-1f3fc",40,13,15,["\uD83E\uDD1E\uD83C\uDFFC"]],"1f3fd":["1f91e-1f3fd",40,14,15,["\uD83E\uDD1E\uD83C\uDFFD"]],"1f3fe":["1f91e-1f3fe",40,15,15,["\uD83E\uDD1E\uD83C\uDFFE"]],"1f3ff":["1f91e-1f3ff",40,16,15,["\uD83E\uDD1E\uD83C\uDFFF"]]},
		"1f91f":{"1f3fb":["1f91f-1f3fb",40,18,15,["\uD83E\uDD1F\uD83C\uDFFB"]],"1f3fc":["1f91f-1f3fc",40,19,15,["\uD83E\uDD1F\uD83C\uDFFC"]],"1f3fd":["1f91f-1f3fd",40,20,15,["\uD83E\uDD1F\uD83C\uDFFD"]],"1f3fe":["1f91f-1f3fe",40,21,15,["\uD83E\uDD1F\uD83C\uDFFE"]],"1f3ff":["1f91f-1f3ff",40,22,15,["\uD83E\uDD1F\uD83C\uDFFF"]]},
		"1f926-200d-2640-fe0f":{"1f3fb":["1f926-1f3fb-200d-2640-fe0f",40,30,15,["\uD83E\uDD26\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f926-1f3fc-200d-2640-fe0f",40,31,15,["\uD83E\uDD26\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f926-1f3fd-200d-2640-fe0f",40,32,15,["\uD83E\uDD26\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f926-1f3fe-200d-2640-fe0f",40,33,15,["\uD83E\uDD26\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f926-1f3ff-200d-2640-fe0f",40,34,15,["\uD83E\uDD26\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f926-200d-2642-fe0f":{"1f3fb":["1f926-1f3fb-200d-2642-fe0f",40,36,15,["\uD83E\uDD26\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f926-1f3fc-200d-2642-fe0f",40,37,15,["\uD83E\uDD26\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f926-1f3fd-200d-2642-fe0f",40,38,15,["\uD83E\uDD26\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f926-1f3fe-200d-2642-fe0f",40,39,15,["\uD83E\uDD26\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f926-1f3ff-200d-2642-fe0f",40,40,15,["\uD83E\uDD26\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f926":{"1f3fb":["1f926-1f3fb",40,42,15,["\uD83E\uDD26\uD83C\uDFFB"]],"1f3fc":["1f926-1f3fc",40,43,15,["\uD83E\uDD26\uD83C\uDFFC"]],"1f3fd":["1f926-1f3fd",40,44,15,["\uD83E\uDD26\uD83C\uDFFD"]],"1f3fe":["1f926-1f3fe",40,45,15,["\uD83E\uDD26\uD83C\uDFFE"]],"1f3ff":["1f926-1f3ff",40,46,15,["\uD83E\uDD26\uD83C\uDFFF"]]},
		"1f930":{"1f3fb":["1f930-1f3fb",40,57,15,["\uD83E\uDD30\uD83C\uDFFB"]],"1f3fc":["1f930-1f3fc",40,58,15,["\uD83E\uDD30\uD83C\uDFFC"]],"1f3fd":["1f930-1f3fd",40,59,15,["\uD83E\uDD30\uD83C\uDFFD"]],"1f3fe":["1f930-1f3fe",41,0,15,["\uD83E\uDD30\uD83C\uDFFE"]],"1f3ff":["1f930-1f3ff",41,1,15,["\uD83E\uDD30\uD83C\uDFFF"]]},
		"1f931":{"1f3fb":["1f931-1f3fb",41,3,15,["\uD83E\uDD31\uD83C\uDFFB"]],"1f3fc":["1f931-1f3fc",41,4,15,["\uD83E\uDD31\uD83C\uDFFC"]],"1f3fd":["1f931-1f3fd",41,5,15,["\uD83E\uDD31\uD83C\uDFFD"]],"1f3fe":["1f931-1f3fe",41,6,15,["\uD83E\uDD31\uD83C\uDFFE"]],"1f3ff":["1f931-1f3ff",41,7,15,["\uD83E\uDD31\uD83C\uDFFF"]]},
		"1f932":{"1f3fb":["1f932-1f3fb",41,9,15,["\uD83E\uDD32\uD83C\uDFFB"]],"1f3fc":["1f932-1f3fc",41,10,15,["\uD83E\uDD32\uD83C\uDFFC"]],"1f3fd":["1f932-1f3fd",41,11,15,["\uD83E\uDD32\uD83C\uDFFD"]],"1f3fe":["1f932-1f3fe",41,12,15,["\uD83E\uDD32\uD83C\uDFFE"]],"1f3ff":["1f932-1f3ff",41,13,15,["\uD83E\uDD32\uD83C\uDFFF"]]},
		"1f933":{"1f3fb":["1f933-1f3fb",41,15,15,["\uD83E\uDD33\uD83C\uDFFB"]],"1f3fc":["1f933-1f3fc",41,16,15,["\uD83E\uDD33\uD83C\uDFFC"]],"1f3fd":["1f933-1f3fd",41,17,15,["\uD83E\uDD33\uD83C\uDFFD"]],"1f3fe":["1f933-1f3fe",41,18,15,["\uD83E\uDD33\uD83C\uDFFE"]],"1f3ff":["1f933-1f3ff",41,19,15,["\uD83E\uDD33\uD83C\uDFFF"]]},
		"1f934":{"1f3fb":["1f934-1f3fb",41,21,15,["\uD83E\uDD34\uD83C\uDFFB"]],"1f3fc":["1f934-1f3fc",41,22,15,["\uD83E\uDD34\uD83C\uDFFC"]],"1f3fd":["1f934-1f3fd",41,23,15,["\uD83E\uDD34\uD83C\uDFFD"]],"1f3fe":["1f934-1f3fe",41,24,15,["\uD83E\uDD34\uD83C\uDFFE"]],"1f3ff":["1f934-1f3ff",41,25,15,["\uD83E\uDD34\uD83C\uDFFF"]]},
		"1f935-200d-2640-fe0f":{"1f3fb":["1f935-1f3fb-200d-2640-fe0f",41,27,15,["\uD83E\uDD35\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f935-1f3fc-200d-2640-fe0f",41,28,15,["\uD83E\uDD35\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f935-1f3fd-200d-2640-fe0f",41,29,15,["\uD83E\uDD35\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f935-1f3fe-200d-2640-fe0f",41,30,15,["\uD83E\uDD35\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f935-1f3ff-200d-2640-fe0f",41,31,15,["\uD83E\uDD35\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f935-200d-2642-fe0f":{"1f3fb":["1f935-1f3fb-200d-2642-fe0f",41,33,15,["\uD83E\uDD35\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f935-1f3fc-200d-2642-fe0f",41,34,15,["\uD83E\uDD35\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f935-1f3fd-200d-2642-fe0f",41,35,15,["\uD83E\uDD35\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f935-1f3fe-200d-2642-fe0f",41,36,15,["\uD83E\uDD35\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f935-1f3ff-200d-2642-fe0f",41,37,15,["\uD83E\uDD35\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f935":{"1f3fb":["1f935-1f3fb",41,39,15,["\uD83E\uDD35\uD83C\uDFFB"]],"1f3fc":["1f935-1f3fc",41,40,15,["\uD83E\uDD35\uD83C\uDFFC"]],"1f3fd":["1f935-1f3fd",41,41,15,["\uD83E\uDD35\uD83C\uDFFD"]],"1f3fe":["1f935-1f3fe",41,42,15,["\uD83E\uDD35\uD83C\uDFFE"]],"1f3ff":["1f935-1f3ff",41,43,15,["\uD83E\uDD35\uD83C\uDFFF"]]},
		"1f936":{"1f3fb":["1f936-1f3fb",41,45,15,["\uD83E\uDD36\uD83C\uDFFB"]],"1f3fc":["1f936-1f3fc",41,46,15,["\uD83E\uDD36\uD83C\uDFFC"]],"1f3fd":["1f936-1f3fd",41,47,15,["\uD83E\uDD36\uD83C\uDFFD"]],"1f3fe":["1f936-1f3fe",41,48,15,["\uD83E\uDD36\uD83C\uDFFE"]],"1f3ff":["1f936-1f3ff",41,49,15,["\uD83E\uDD36\uD83C\uDFFF"]]},
		"1f937-200d-2640-fe0f":{"1f3fb":["1f937-1f3fb-200d-2640-fe0f",41,51,15,["\uD83E\uDD37\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f937-1f3fc-200d-2640-fe0f",41,52,15,["\uD83E\uDD37\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f937-1f3fd-200d-2640-fe0f",41,53,15,["\uD83E\uDD37\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f937-1f3fe-200d-2640-fe0f",41,54,15,["\uD83E\uDD37\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f937-1f3ff-200d-2640-fe0f",41,55,15,["\uD83E\uDD37\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f937-200d-2642-fe0f":{"1f3fb":["1f937-1f3fb-200d-2642-fe0f",41,57,15,["\uD83E\uDD37\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f937-1f3fc-200d-2642-fe0f",41,58,15,["\uD83E\uDD37\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f937-1f3fd-200d-2642-fe0f",41,59,15,["\uD83E\uDD37\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f937-1f3fe-200d-2642-fe0f",42,0,15,["\uD83E\uDD37\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f937-1f3ff-200d-2642-fe0f",42,1,15,["\uD83E\uDD37\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f937":{"1f3fb":["1f937-1f3fb",42,3,15,["\uD83E\uDD37\uD83C\uDFFB"]],"1f3fc":["1f937-1f3fc",42,4,15,["\uD83E\uDD37\uD83C\uDFFC"]],"1f3fd":["1f937-1f3fd",42,5,15,["\uD83E\uDD37\uD83C\uDFFD"]],"1f3fe":["1f937-1f3fe",42,6,15,["\uD83E\uDD37\uD83C\uDFFE"]],"1f3ff":["1f937-1f3ff",42,7,15,["\uD83E\uDD37\uD83C\uDFFF"]]},
		"1f938-200d-2640-fe0f":{"1f3fb":["1f938-1f3fb-200d-2640-fe0f",42,9,15,["\uD83E\uDD38\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f938-1f3fc-200d-2640-fe0f",42,10,15,["\uD83E\uDD38\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f938-1f3fd-200d-2640-fe0f",42,11,15,["\uD83E\uDD38\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f938-1f3fe-200d-2640-fe0f",42,12,15,["\uD83E\uDD38\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f938-1f3ff-200d-2640-fe0f",42,13,15,["\uD83E\uDD38\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f938-200d-2642-fe0f":{"1f3fb":["1f938-1f3fb-200d-2642-fe0f",42,15,15,["\uD83E\uDD38\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f938-1f3fc-200d-2642-fe0f",42,16,15,["\uD83E\uDD38\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f938-1f3fd-200d-2642-fe0f",42,17,15,["\uD83E\uDD38\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f938-1f3fe-200d-2642-fe0f",42,18,15,["\uD83E\uDD38\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f938-1f3ff-200d-2642-fe0f",42,19,15,["\uD83E\uDD38\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f938":{"1f3fb":["1f938-1f3fb",42,21,15,["\uD83E\uDD38\uD83C\uDFFB"]],"1f3fc":["1f938-1f3fc",42,22,15,["\uD83E\uDD38\uD83C\uDFFC"]],"1f3fd":["1f938-1f3fd",42,23,15,["\uD83E\uDD38\uD83C\uDFFD"]],"1f3fe":["1f938-1f3fe",42,24,15,["\uD83E\uDD38\uD83C\uDFFE"]],"1f3ff":["1f938-1f3ff",42,25,15,["\uD83E\uDD38\uD83C\uDFFF"]]},
		"1f939-200d-2640-fe0f":{"1f3fb":["1f939-1f3fb-200d-2640-fe0f",42,27,15,["\uD83E\uDD39\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f939-1f3fc-200d-2640-fe0f",42,28,15,["\uD83E\uDD39\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f939-1f3fd-200d-2640-fe0f",42,29,15,["\uD83E\uDD39\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f939-1f3fe-200d-2640-fe0f",42,30,15,["\uD83E\uDD39\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f939-1f3ff-200d-2640-fe0f",42,31,15,["\uD83E\uDD39\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f939-200d-2642-fe0f":{"1f3fb":["1f939-1f3fb-200d-2642-fe0f",42,33,15,["\uD83E\uDD39\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f939-1f3fc-200d-2642-fe0f",42,34,15,["\uD83E\uDD39\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f939-1f3fd-200d-2642-fe0f",42,35,15,["\uD83E\uDD39\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f939-1f3fe-200d-2642-fe0f",42,36,15,["\uD83E\uDD39\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f939-1f3ff-200d-2642-fe0f",42,37,15,["\uD83E\uDD39\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f939":{"1f3fb":["1f939-1f3fb",42,39,15,["\uD83E\uDD39\uD83C\uDFFB"]],"1f3fc":["1f939-1f3fc",42,40,15,["\uD83E\uDD39\uD83C\uDFFC"]],"1f3fd":["1f939-1f3fd",42,41,15,["\uD83E\uDD39\uD83C\uDFFD"]],"1f3fe":["1f939-1f3fe",42,42,15,["\uD83E\uDD39\uD83C\uDFFE"]],"1f3ff":["1f939-1f3ff",42,43,15,["\uD83E\uDD39\uD83C\uDFFF"]]},
		"1f93d-200d-2640-fe0f":{"1f3fb":["1f93d-1f3fb-200d-2640-fe0f",42,49,15,["\uD83E\uDD3D\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f93d-1f3fc-200d-2640-fe0f",42,50,15,["\uD83E\uDD3D\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f93d-1f3fd-200d-2640-fe0f",42,51,15,["\uD83E\uDD3D\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f93d-1f3fe-200d-2640-fe0f",42,52,15,["\uD83E\uDD3D\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f93d-1f3ff-200d-2640-fe0f",42,53,15,["\uD83E\uDD3D\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f93d-200d-2642-fe0f":{"1f3fb":["1f93d-1f3fb-200d-2642-fe0f",42,55,15,["\uD83E\uDD3D\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f93d-1f3fc-200d-2642-fe0f",42,56,15,["\uD83E\uDD3D\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f93d-1f3fd-200d-2642-fe0f",42,57,15,["\uD83E\uDD3D\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f93d-1f3fe-200d-2642-fe0f",42,58,15,["\uD83E\uDD3D\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f93d-1f3ff-200d-2642-fe0f",42,59,15,["\uD83E\uDD3D\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f93d":{"1f3fb":["1f93d-1f3fb",43,1,15,["\uD83E\uDD3D\uD83C\uDFFB"]],"1f3fc":["1f93d-1f3fc",43,2,15,["\uD83E\uDD3D\uD83C\uDFFC"]],"1f3fd":["1f93d-1f3fd",43,3,15,["\uD83E\uDD3D\uD83C\uDFFD"]],"1f3fe":["1f93d-1f3fe",43,4,15,["\uD83E\uDD3D\uD83C\uDFFE"]],"1f3ff":["1f93d-1f3ff",43,5,15,["\uD83E\uDD3D\uD83C\uDFFF"]]},
		"1f93e-200d-2640-fe0f":{"1f3fb":["1f93e-1f3fb-200d-2640-fe0f",43,7,15,["\uD83E\uDD3E\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f93e-1f3fc-200d-2640-fe0f",43,8,15,["\uD83E\uDD3E\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f93e-1f3fd-200d-2640-fe0f",43,9,15,["\uD83E\uDD3E\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f93e-1f3fe-200d-2640-fe0f",43,10,15,["\uD83E\uDD3E\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f93e-1f3ff-200d-2640-fe0f",43,11,15,["\uD83E\uDD3E\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f93e-200d-2642-fe0f":{"1f3fb":["1f93e-1f3fb-200d-2642-fe0f",43,13,15,["\uD83E\uDD3E\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f93e-1f3fc-200d-2642-fe0f",43,14,15,["\uD83E\uDD3E\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f93e-1f3fd-200d-2642-fe0f",43,15,15,["\uD83E\uDD3E\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f93e-1f3fe-200d-2642-fe0f",43,16,15,["\uD83E\uDD3E\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f93e-1f3ff-200d-2642-fe0f",43,17,15,["\uD83E\uDD3E\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f93e":{"1f3fb":["1f93e-1f3fb",43,19,15,["\uD83E\uDD3E\uD83C\uDFFB"]],"1f3fc":["1f93e-1f3fc",43,20,15,["\uD83E\uDD3E\uD83C\uDFFC"]],"1f3fd":["1f93e-1f3fd",43,21,15,["\uD83E\uDD3E\uD83C\uDFFD"]],"1f3fe":["1f93e-1f3fe",43,22,15,["\uD83E\uDD3E\uD83C\uDFFE"]],"1f3ff":["1f93e-1f3ff",43,23,15,["\uD83E\uDD3E\uD83C\uDFFF"]]},
		"1f977":{"1f3fb":["1f977-1f3fb",44,20,15,["\uD83E\uDD77\uD83C\uDFFB"]],"1f3fc":["1f977-1f3fc",44,21,15,["\uD83E\uDD77\uD83C\uDFFC"]],"1f3fd":["1f977-1f3fd",44,22,15,["\uD83E\uDD77\uD83C\uDFFD"]],"1f3fe":["1f977-1f3fe",44,23,15,["\uD83E\uDD77\uD83C\uDFFE"]],"1f3ff":["1f977-1f3ff",44,24,15,["\uD83E\uDD77\uD83C\uDFFF"]]},
		"1f9b5":{"1f3fb":["1f9b5-1f3fb",45,22,15,["\uD83E\uDDB5\uD83C\uDFFB"]],"1f3fc":["1f9b5-1f3fc",45,23,15,["\uD83E\uDDB5\uD83C\uDFFC"]],"1f3fd":["1f9b5-1f3fd",45,24,15,["\uD83E\uDDB5\uD83C\uDFFD"]],"1f3fe":["1f9b5-1f3fe",45,25,15,["\uD83E\uDDB5\uD83C\uDFFE"]],"1f3ff":["1f9b5-1f3ff",45,26,15,["\uD83E\uDDB5\uD83C\uDFFF"]]},
		"1f9b6":{"1f3fb":["1f9b6-1f3fb",45,28,15,["\uD83E\uDDB6\uD83C\uDFFB"]],"1f3fc":["1f9b6-1f3fc",45,29,15,["\uD83E\uDDB6\uD83C\uDFFC"]],"1f3fd":["1f9b6-1f3fd",45,30,15,["\uD83E\uDDB6\uD83C\uDFFD"]],"1f3fe":["1f9b6-1f3fe",45,31,15,["\uD83E\uDDB6\uD83C\uDFFE"]],"1f3ff":["1f9b6-1f3ff",45,32,15,["\uD83E\uDDB6\uD83C\uDFFF"]]},
		"1f9b8-200d-2640-fe0f":{"1f3fb":["1f9b8-1f3fb-200d-2640-fe0f",45,35,15,["\uD83E\uDDB8\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9b8-1f3fc-200d-2640-fe0f",45,36,15,["\uD83E\uDDB8\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9b8-1f3fd-200d-2640-fe0f",45,37,15,["\uD83E\uDDB8\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9b8-1f3fe-200d-2640-fe0f",45,38,15,["\uD83E\uDDB8\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9b8-1f3ff-200d-2640-fe0f",45,39,15,["\uD83E\uDDB8\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9b8-200d-2642-fe0f":{"1f3fb":["1f9b8-1f3fb-200d-2642-fe0f",45,41,15,["\uD83E\uDDB8\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9b8-1f3fc-200d-2642-fe0f",45,42,15,["\uD83E\uDDB8\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9b8-1f3fd-200d-2642-fe0f",45,43,15,["\uD83E\uDDB8\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9b8-1f3fe-200d-2642-fe0f",45,44,15,["\uD83E\uDDB8\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9b8-1f3ff-200d-2642-fe0f",45,45,15,["\uD83E\uDDB8\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9b8":{"1f3fb":["1f9b8-1f3fb",45,47,15,["\uD83E\uDDB8\uD83C\uDFFB"]],"1f3fc":["1f9b8-1f3fc",45,48,15,["\uD83E\uDDB8\uD83C\uDFFC"]],"1f3fd":["1f9b8-1f3fd",45,49,15,["\uD83E\uDDB8\uD83C\uDFFD"]],"1f3fe":["1f9b8-1f3fe",45,50,15,["\uD83E\uDDB8\uD83C\uDFFE"]],"1f3ff":["1f9b8-1f3ff",45,51,15,["\uD83E\uDDB8\uD83C\uDFFF"]]},
		"1f9b9-200d-2640-fe0f":{"1f3fb":["1f9b9-1f3fb-200d-2640-fe0f",45,53,15,["\uD83E\uDDB9\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9b9-1f3fc-200d-2640-fe0f",45,54,15,["\uD83E\uDDB9\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9b9-1f3fd-200d-2640-fe0f",45,55,15,["\uD83E\uDDB9\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9b9-1f3fe-200d-2640-fe0f",45,56,15,["\uD83E\uDDB9\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9b9-1f3ff-200d-2640-fe0f",45,57,15,["\uD83E\uDDB9\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9b9-200d-2642-fe0f":{"1f3fb":["1f9b9-1f3fb-200d-2642-fe0f",45,59,15,["\uD83E\uDDB9\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9b9-1f3fc-200d-2642-fe0f",46,0,15,["\uD83E\uDDB9\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9b9-1f3fd-200d-2642-fe0f",46,1,15,["\uD83E\uDDB9\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9b9-1f3fe-200d-2642-fe0f",46,2,15,["\uD83E\uDDB9\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9b9-1f3ff-200d-2642-fe0f",46,3,15,["\uD83E\uDDB9\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9b9":{"1f3fb":["1f9b9-1f3fb",46,5,15,["\uD83E\uDDB9\uD83C\uDFFB"]],"1f3fc":["1f9b9-1f3fc",46,6,15,["\uD83E\uDDB9\uD83C\uDFFC"]],"1f3fd":["1f9b9-1f3fd",46,7,15,["\uD83E\uDDB9\uD83C\uDFFD"]],"1f3fe":["1f9b9-1f3fe",46,8,15,["\uD83E\uDDB9\uD83C\uDFFE"]],"1f3ff":["1f9b9-1f3ff",46,9,15,["\uD83E\uDDB9\uD83C\uDFFF"]]},
		"1f9bb":{"1f3fb":["1f9bb-1f3fb",46,12,15,["\uD83E\uDDBB\uD83C\uDFFB"]],"1f3fc":["1f9bb-1f3fc",46,13,15,["\uD83E\uDDBB\uD83C\uDFFC"]],"1f3fd":["1f9bb-1f3fd",46,14,15,["\uD83E\uDDBB\uD83C\uDFFD"]],"1f3fe":["1f9bb-1f3fe",46,15,15,["\uD83E\uDDBB\uD83C\uDFFE"]],"1f3ff":["1f9bb-1f3ff",46,16,15,["\uD83E\uDDBB\uD83C\uDFFF"]]},
		"1f9cd-200d-2640-fe0f":{"1f3fb":["1f9cd-1f3fb-200d-2640-fe0f",46,34,15,["\uD83E\uDDCD\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9cd-1f3fc-200d-2640-fe0f",46,35,15,["\uD83E\uDDCD\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9cd-1f3fd-200d-2640-fe0f",46,36,15,["\uD83E\uDDCD\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9cd-1f3fe-200d-2640-fe0f",46,37,15,["\uD83E\uDDCD\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9cd-1f3ff-200d-2640-fe0f",46,38,15,["\uD83E\uDDCD\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9cd-200d-2642-fe0f":{"1f3fb":["1f9cd-1f3fb-200d-2642-fe0f",46,40,15,["\uD83E\uDDCD\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9cd-1f3fc-200d-2642-fe0f",46,41,15,["\uD83E\uDDCD\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9cd-1f3fd-200d-2642-fe0f",46,42,15,["\uD83E\uDDCD\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9cd-1f3fe-200d-2642-fe0f",46,43,15,["\uD83E\uDDCD\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9cd-1f3ff-200d-2642-fe0f",46,44,15,["\uD83E\uDDCD\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9cd":{"1f3fb":["1f9cd-1f3fb",46,46,15,["\uD83E\uDDCD\uD83C\uDFFB"]],"1f3fc":["1f9cd-1f3fc",46,47,15,["\uD83E\uDDCD\uD83C\uDFFC"]],"1f3fd":["1f9cd-1f3fd",46,48,15,["\uD83E\uDDCD\uD83C\uDFFD"]],"1f3fe":["1f9cd-1f3fe",46,49,15,["\uD83E\uDDCD\uD83C\uDFFE"]],"1f3ff":["1f9cd-1f3ff",46,50,15,["\uD83E\uDDCD\uD83C\uDFFF"]]},
		"1f9ce-200d-2640-fe0f":{"1f3fb":["1f9ce-1f3fb-200d-2640-fe0f",46,52,15,["\uD83E\uDDCE\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9ce-1f3fc-200d-2640-fe0f",46,53,15,["\uD83E\uDDCE\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9ce-1f3fd-200d-2640-fe0f",46,54,15,["\uD83E\uDDCE\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9ce-1f3fe-200d-2640-fe0f",46,55,15,["\uD83E\uDDCE\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9ce-1f3ff-200d-2640-fe0f",46,56,15,["\uD83E\uDDCE\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9ce-200d-2642-fe0f":{"1f3fb":["1f9ce-1f3fb-200d-2642-fe0f",46,58,15,["\uD83E\uDDCE\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9ce-1f3fc-200d-2642-fe0f",46,59,15,["\uD83E\uDDCE\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9ce-1f3fd-200d-2642-fe0f",47,0,15,["\uD83E\uDDCE\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9ce-1f3fe-200d-2642-fe0f",47,1,15,["\uD83E\uDDCE\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9ce-1f3ff-200d-2642-fe0f",47,2,15,["\uD83E\uDDCE\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9ce":{"1f3fb":["1f9ce-1f3fb",47,4,15,["\uD83E\uDDCE\uD83C\uDFFB"]],"1f3fc":["1f9ce-1f3fc",47,5,15,["\uD83E\uDDCE\uD83C\uDFFC"]],"1f3fd":["1f9ce-1f3fd",47,6,15,["\uD83E\uDDCE\uD83C\uDFFD"]],"1f3fe":["1f9ce-1f3fe",47,7,15,["\uD83E\uDDCE\uD83C\uDFFE"]],"1f3ff":["1f9ce-1f3ff",47,8,15,["\uD83E\uDDCE\uD83C\uDFFF"]]},
		"1f9cf-200d-2640-fe0f":{"1f3fb":["1f9cf-1f3fb-200d-2640-fe0f",47,10,15,["\uD83E\uDDCF\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9cf-1f3fc-200d-2640-fe0f",47,11,15,["\uD83E\uDDCF\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9cf-1f3fd-200d-2640-fe0f",47,12,15,["\uD83E\uDDCF\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9cf-1f3fe-200d-2640-fe0f",47,13,15,["\uD83E\uDDCF\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9cf-1f3ff-200d-2640-fe0f",47,14,15,["\uD83E\uDDCF\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9cf-200d-2642-fe0f":{"1f3fb":["1f9cf-1f3fb-200d-2642-fe0f",47,16,15,["\uD83E\uDDCF\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9cf-1f3fc-200d-2642-fe0f",47,17,15,["\uD83E\uDDCF\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9cf-1f3fd-200d-2642-fe0f",47,18,15,["\uD83E\uDDCF\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9cf-1f3fe-200d-2642-fe0f",47,19,15,["\uD83E\uDDCF\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9cf-1f3ff-200d-2642-fe0f",47,20,15,["\uD83E\uDDCF\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9cf":{"1f3fb":["1f9cf-1f3fb",47,22,15,["\uD83E\uDDCF\uD83C\uDFFB"]],"1f3fc":["1f9cf-1f3fc",47,23,15,["\uD83E\uDDCF\uD83C\uDFFC"]],"1f3fd":["1f9cf-1f3fd",47,24,15,["\uD83E\uDDCF\uD83C\uDFFD"]],"1f3fe":["1f9cf-1f3fe",47,25,15,["\uD83E\uDDCF\uD83C\uDFFE"]],"1f3ff":["1f9cf-1f3ff",47,26,15,["\uD83E\uDDCF\uD83C\uDFFF"]]},
		"1f9d1-200d-1f33e":{"1f3fb":["1f9d1-1f3fb-200d-1f33e",47,29,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDF3E"]],"1f3fc":["1f9d1-1f3fc-200d-1f33e",47,30,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDF3E"]],"1f3fd":["1f9d1-1f3fd-200d-1f33e",47,31,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDF3E"]],"1f3fe":["1f9d1-1f3fe-200d-1f33e",47,32,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDF3E"]],"1f3ff":["1f9d1-1f3ff-200d-1f33e",47,33,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDF3E"]]},
		"1f9d1-200d-1f373":{"1f3fb":["1f9d1-1f3fb-200d-1f373",47,35,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDF73"]],"1f3fc":["1f9d1-1f3fc-200d-1f373",47,36,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDF73"]],"1f3fd":["1f9d1-1f3fd-200d-1f373",47,37,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDF73"]],"1f3fe":["1f9d1-1f3fe-200d-1f373",47,38,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDF73"]],"1f3ff":["1f9d1-1f3ff-200d-1f373",47,39,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDF73"]]},
		"1f9d1-200d-1f37c":{"1f3fb":["1f9d1-1f3fb-200d-1f37c",47,41,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDF7C"]],"1f3fc":["1f9d1-1f3fc-200d-1f37c",47,42,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDF7C"]],"1f3fd":["1f9d1-1f3fd-200d-1f37c",47,43,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDF7C"]],"1f3fe":["1f9d1-1f3fe-200d-1f37c",47,44,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDF7C"]],"1f3ff":["1f9d1-1f3ff-200d-1f37c",47,45,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDF7C"]]},
		"1f9d1-200d-1f384":{"1f3fb":["1f9d1-1f3fb-200d-1f384",47,47,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDF84"]],"1f3fc":["1f9d1-1f3fc-200d-1f384",47,48,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDF84"]],"1f3fd":["1f9d1-1f3fd-200d-1f384",47,49,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDF84"]],"1f3fe":["1f9d1-1f3fe-200d-1f384",47,50,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDF84"]],"1f3ff":["1f9d1-1f3ff-200d-1f384",47,51,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDF84"]]},
		"1f9d1-200d-1f393":{"1f3fb":["1f9d1-1f3fb-200d-1f393",47,53,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDF93"]],"1f3fc":["1f9d1-1f3fc-200d-1f393",47,54,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDF93"]],"1f3fd":["1f9d1-1f3fd-200d-1f393",47,55,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDF93"]],"1f3fe":["1f9d1-1f3fe-200d-1f393",47,56,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDF93"]],"1f3ff":["1f9d1-1f3ff-200d-1f393",47,57,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDF93"]]},
		"1f9d1-200d-1f3a4":{"1f3fb":["1f9d1-1f3fb-200d-1f3a4",47,59,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDFA4"]],"1f3fc":["1f9d1-1f3fc-200d-1f3a4",48,0,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDFA4"]],"1f3fd":["1f9d1-1f3fd-200d-1f3a4",48,1,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDFA4"]],"1f3fe":["1f9d1-1f3fe-200d-1f3a4",48,2,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDFA4"]],"1f3ff":["1f9d1-1f3ff-200d-1f3a4",48,3,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDFA4"]]},
		"1f9d1-200d-1f3a8":{"1f3fb":["1f9d1-1f3fb-200d-1f3a8",48,5,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDFA8"]],"1f3fc":["1f9d1-1f3fc-200d-1f3a8",48,6,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDFA8"]],"1f3fd":["1f9d1-1f3fd-200d-1f3a8",48,7,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDFA8"]],"1f3fe":["1f9d1-1f3fe-200d-1f3a8",48,8,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDFA8"]],"1f3ff":["1f9d1-1f3ff-200d-1f3a8",48,9,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDFA8"]]},
		"1f9d1-200d-1f3eb":{"1f3fb":["1f9d1-1f3fb-200d-1f3eb",48,11,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDFEB"]],"1f3fc":["1f9d1-1f3fc-200d-1f3eb",48,12,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDFEB"]],"1f3fd":["1f9d1-1f3fd-200d-1f3eb",48,13,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDFEB"]],"1f3fe":["1f9d1-1f3fe-200d-1f3eb",48,14,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDFEB"]],"1f3ff":["1f9d1-1f3ff-200d-1f3eb",48,15,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDFEB"]]},
		"1f9d1-200d-1f3ed":{"1f3fb":["1f9d1-1f3fb-200d-1f3ed",48,17,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83C\uDFED"]],"1f3fc":["1f9d1-1f3fc-200d-1f3ed",48,18,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83C\uDFED"]],"1f3fd":["1f9d1-1f3fd-200d-1f3ed",48,19,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83C\uDFED"]],"1f3fe":["1f9d1-1f3fe-200d-1f3ed",48,20,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83C\uDFED"]],"1f3ff":["1f9d1-1f3ff-200d-1f3ed",48,21,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83C\uDFED"]]},
		"1f9d1-200d-1f4bb":{"1f3fb":["1f9d1-1f3fb-200d-1f4bb",48,23,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDCBB"]],"1f3fc":["1f9d1-1f3fc-200d-1f4bb",48,24,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDCBB"]],"1f3fd":["1f9d1-1f3fd-200d-1f4bb",48,25,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDCBB"]],"1f3fe":["1f9d1-1f3fe-200d-1f4bb",48,26,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDCBB"]],"1f3ff":["1f9d1-1f3ff-200d-1f4bb",48,27,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDCBB"]]},
		"1f9d1-200d-1f4bc":{"1f3fb":["1f9d1-1f3fb-200d-1f4bc",48,29,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDCBC"]],"1f3fc":["1f9d1-1f3fc-200d-1f4bc",48,30,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDCBC"]],"1f3fd":["1f9d1-1f3fd-200d-1f4bc",48,31,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDCBC"]],"1f3fe":["1f9d1-1f3fe-200d-1f4bc",48,32,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDCBC"]],"1f3ff":["1f9d1-1f3ff-200d-1f4bc",48,33,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDCBC"]]},
		"1f9d1-200d-1f527":{"1f3fb":["1f9d1-1f3fb-200d-1f527",48,35,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDD27"]],"1f3fc":["1f9d1-1f3fc-200d-1f527",48,36,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDD27"]],"1f3fd":["1f9d1-1f3fd-200d-1f527",48,37,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDD27"]],"1f3fe":["1f9d1-1f3fe-200d-1f527",48,38,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDD27"]],"1f3ff":["1f9d1-1f3ff-200d-1f527",48,39,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDD27"]]},
		"1f9d1-200d-1f52c":{"1f3fb":["1f9d1-1f3fb-200d-1f52c",48,41,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDD2C"]],"1f3fc":["1f9d1-1f3fc-200d-1f52c",48,42,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDD2C"]],"1f3fd":["1f9d1-1f3fd-200d-1f52c",48,43,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDD2C"]],"1f3fe":["1f9d1-1f3fe-200d-1f52c",48,44,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDD2C"]],"1f3ff":["1f9d1-1f3ff-200d-1f52c",48,45,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDD2C"]]},
		"1f9d1-200d-1f680":{"1f3fb":["1f9d1-1f3fb-200d-1f680",48,47,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDE80"]],"1f3fc":["1f9d1-1f3fc-200d-1f680",48,48,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDE80"]],"1f3fd":["1f9d1-1f3fd-200d-1f680",48,49,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDE80"]],"1f3fe":["1f9d1-1f3fe-200d-1f680",48,50,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDE80"]],"1f3ff":["1f9d1-1f3ff-200d-1f680",48,51,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDE80"]]},
		"1f9d1-200d-1f692":{"1f3fb":["1f9d1-1f3fb-200d-1f692",48,53,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83D\uDE92"]],"1f3fc":["1f9d1-1f3fc-200d-1f692",48,54,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83D\uDE92"]],"1f3fd":["1f9d1-1f3fd-200d-1f692",48,55,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83D\uDE92"]],"1f3fe":["1f9d1-1f3fe-200d-1f692",48,56,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83D\uDE92"]],"1f3ff":["1f9d1-1f3ff-200d-1f692",48,57,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83D\uDE92"]]},
		"1f9d1-200d-1f91d-200d-1f9d1":{"1f3fb-1f3fb":["1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3fb",48,59,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fb-1f3fc":["1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3fc",49,0,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fb-1f3fd":["1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3fd",49,1,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fb-1f3fe":["1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3fe",49,2,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fb-1f3ff":["1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3ff",49,3,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fc-1f3fb":["1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3fb",49,4,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fc-1f3fc":["1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3fc",49,5,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fc-1f3fd":["1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3fd",49,6,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fc-1f3fe":["1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3fe",49,7,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fc-1f3ff":["1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3ff",49,8,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fd-1f3fb":["1f9d1-1f3fd-200d-1f91d-200d-1f9d1-1f3fb",49,9,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fd-1f3fc":["1f9d1-1f3fd-200d-1f91d-200d-1f9d1-1f3fc",49,10,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fd-1f3fd":["1f9d1-1f3fd-200d-1f91d-200d-1f9d1-1f3fd",49,11,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fd-1f3fe":["1f9d1-1f3fd-200d-1f91d-200d-1f9d1-1f3fe",49,12,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fd-1f3ff":["1f9d1-1f3fd-200d-1f91d-200d-1f9d1-1f3ff",49,13,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3fe-1f3fb":["1f9d1-1f3fe-200d-1f91d-200d-1f9d1-1f3fb",49,14,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fe-1f3fc":["1f9d1-1f3fe-200d-1f91d-200d-1f9d1-1f3fc",49,15,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fe-1f3fd":["1f9d1-1f3fe-200d-1f91d-200d-1f9d1-1f3fd",49,16,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fe-1f3fe":["1f9d1-1f3fe-200d-1f91d-200d-1f9d1-1f3fe",49,17,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3fe-1f3ff":["1f9d1-1f3fe-200d-1f91d-200d-1f9d1-1f3ff",49,18,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFF"]],"1f3ff-1f3fb":["1f9d1-1f3ff-200d-1f91d-200d-1f9d1-1f3fb",49,19,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFB"]],"1f3ff-1f3fc":["1f9d1-1f3ff-200d-1f91d-200d-1f9d1-1f3fc",49,20,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFC"]],"1f3ff-1f3fd":["1f9d1-1f3ff-200d-1f91d-200d-1f9d1-1f3fd",49,21,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFD"]],"1f3ff-1f3fe":["1f9d1-1f3ff-200d-1f91d-200d-1f9d1-1f3fe",49,22,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFE"]],"1f3ff-1f3ff":["1f9d1-1f3ff-200d-1f91d-200d-1f9d1-1f3ff",49,23,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1\uD83C\uDFFF"]]},
		"1f9d1-200d-1f9af":{"1f3fb":["1f9d1-1f3fb-200d-1f9af",49,25,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDAF"]],"1f3fc":["1f9d1-1f3fc-200d-1f9af",49,26,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDAF"]],"1f3fd":["1f9d1-1f3fd-200d-1f9af",49,27,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDAF"]],"1f3fe":["1f9d1-1f3fe-200d-1f9af",49,28,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDAF"]],"1f3ff":["1f9d1-1f3ff-200d-1f9af",49,29,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDAF"]]},
		"1f9d1-200d-1f9b0":{"1f3fb":["1f9d1-1f3fb-200d-1f9b0",49,31,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDB0"]],"1f3fc":["1f9d1-1f3fc-200d-1f9b0",49,32,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDB0"]],"1f3fd":["1f9d1-1f3fd-200d-1f9b0",49,33,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDB0"]],"1f3fe":["1f9d1-1f3fe-200d-1f9b0",49,34,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB0"]],"1f3ff":["1f9d1-1f3ff-200d-1f9b0",49,35,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDB0"]]},
		"1f9d1-200d-1f9b1":{"1f3fb":["1f9d1-1f3fb-200d-1f9b1",49,37,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDB1"]],"1f3fc":["1f9d1-1f3fc-200d-1f9b1",49,38,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDB1"]],"1f3fd":["1f9d1-1f3fd-200d-1f9b1",49,39,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDB1"]],"1f3fe":["1f9d1-1f3fe-200d-1f9b1",49,40,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB1"]],"1f3ff":["1f9d1-1f3ff-200d-1f9b1",49,41,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDB1"]]},
		"1f9d1-200d-1f9b2":{"1f3fb":["1f9d1-1f3fb-200d-1f9b2",49,43,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDB2"]],"1f3fc":["1f9d1-1f3fc-200d-1f9b2",49,44,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDB2"]],"1f3fd":["1f9d1-1f3fd-200d-1f9b2",49,45,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDB2"]],"1f3fe":["1f9d1-1f3fe-200d-1f9b2",49,46,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB2"]],"1f3ff":["1f9d1-1f3ff-200d-1f9b2",49,47,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDB2"]]},
		"1f9d1-200d-1f9b3":{"1f3fb":["1f9d1-1f3fb-200d-1f9b3",49,49,7,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDB3"]],"1f3fc":["1f9d1-1f3fc-200d-1f9b3",49,50,7,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDB3"]],"1f3fd":["1f9d1-1f3fd-200d-1f9b3",49,51,7,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDB3"]],"1f3fe":["1f9d1-1f3fe-200d-1f9b3",49,52,7,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB3"]],"1f3ff":["1f9d1-1f3ff-200d-1f9b3",49,53,7,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDB3"]]},
		"1f9d1-200d-1f9bc":{"1f3fb":["1f9d1-1f3fb-200d-1f9bc",49,55,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDBC"]],"1f3fc":["1f9d1-1f3fc-200d-1f9bc",49,56,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDBC"]],"1f3fd":["1f9d1-1f3fd-200d-1f9bc",49,57,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDBC"]],"1f3fe":["1f9d1-1f3fe-200d-1f9bc",49,58,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDBC"]],"1f3ff":["1f9d1-1f3ff-200d-1f9bc",49,59,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDBC"]]},
		"1f9d1-200d-1f9bd":{"1f3fb":["1f9d1-1f3fb-200d-1f9bd",50,1,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDBD"]],"1f3fc":["1f9d1-1f3fc-200d-1f9bd",50,2,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDDBD"]],"1f3fd":["1f9d1-1f3fd-200d-1f9bd",50,3,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDDBD"]],"1f3fe":["1f9d1-1f3fe-200d-1f9bd",50,4,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDBD"]],"1f3ff":["1f9d1-1f3ff-200d-1f9bd",50,5,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDBD"]]},
		"1f9d1-200d-2695-fe0f":{"1f3fb":["1f9d1-1f3fb-200d-2695-fe0f",50,7,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2695\uFE0F"]],"1f3fc":["1f9d1-1f3fc-200d-2695-fe0f",50,8,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2695\uFE0F"]],"1f3fd":["1f9d1-1f3fd-200d-2695-fe0f",50,9,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2695\uFE0F"]],"1f3fe":["1f9d1-1f3fe-200d-2695-fe0f",50,10,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2695\uFE0F"]],"1f3ff":["1f9d1-1f3ff-200d-2695-fe0f",50,11,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2695\uFE0F"]]},
		"1f9d1-200d-2696-fe0f":{"1f3fb":["1f9d1-1f3fb-200d-2696-fe0f",50,13,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2696\uFE0F"]],"1f3fc":["1f9d1-1f3fc-200d-2696-fe0f",50,14,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2696\uFE0F"]],"1f3fd":["1f9d1-1f3fd-200d-2696-fe0f",50,15,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2696\uFE0F"]],"1f3fe":["1f9d1-1f3fe-200d-2696-fe0f",50,16,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2696\uFE0F"]],"1f3ff":["1f9d1-1f3ff-200d-2696-fe0f",50,17,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2696\uFE0F"]]},
		"1f9d1-200d-2708-fe0f":{"1f3fb":["1f9d1-1f3fb-200d-2708-fe0f",50,19,15,["\uD83E\uDDD1\uD83C\uDFFB\u200D\u2708\uFE0F"]],"1f3fc":["1f9d1-1f3fc-200d-2708-fe0f",50,20,15,["\uD83E\uDDD1\uD83C\uDFFC\u200D\u2708\uFE0F"]],"1f3fd":["1f9d1-1f3fd-200d-2708-fe0f",50,21,15,["\uD83E\uDDD1\uD83C\uDFFD\u200D\u2708\uFE0F"]],"1f3fe":["1f9d1-1f3fe-200d-2708-fe0f",50,22,15,["\uD83E\uDDD1\uD83C\uDFFE\u200D\u2708\uFE0F"]],"1f3ff":["1f9d1-1f3ff-200d-2708-fe0f",50,23,15,["\uD83E\uDDD1\uD83C\uDFFF\u200D\u2708\uFE0F"]]},
		"1f9d1":{"1f3fb":["1f9d1-1f3fb",50,25,15,["\uD83E\uDDD1\uD83C\uDFFB"]],"1f3fc":["1f9d1-1f3fc",50,26,15,["\uD83E\uDDD1\uD83C\uDFFC"]],"1f3fd":["1f9d1-1f3fd",50,27,15,["\uD83E\uDDD1\uD83C\uDFFD"]],"1f3fe":["1f9d1-1f3fe",50,28,15,["\uD83E\uDDD1\uD83C\uDFFE"]],"1f3ff":["1f9d1-1f3ff",50,29,15,["\uD83E\uDDD1\uD83C\uDFFF"]]},
		"1f9d2":{"1f3fb":["1f9d2-1f3fb",50,31,15,["\uD83E\uDDD2\uD83C\uDFFB"]],"1f3fc":["1f9d2-1f3fc",50,32,15,["\uD83E\uDDD2\uD83C\uDFFC"]],"1f3fd":["1f9d2-1f3fd",50,33,15,["\uD83E\uDDD2\uD83C\uDFFD"]],"1f3fe":["1f9d2-1f3fe",50,34,15,["\uD83E\uDDD2\uD83C\uDFFE"]],"1f3ff":["1f9d2-1f3ff",50,35,15,["\uD83E\uDDD2\uD83C\uDFFF"]]},
		"1f9d3":{"1f3fb":["1f9d3-1f3fb",50,37,15,["\uD83E\uDDD3\uD83C\uDFFB"]],"1f3fc":["1f9d3-1f3fc",50,38,15,["\uD83E\uDDD3\uD83C\uDFFC"]],"1f3fd":["1f9d3-1f3fd",50,39,15,["\uD83E\uDDD3\uD83C\uDFFD"]],"1f3fe":["1f9d3-1f3fe",50,40,15,["\uD83E\uDDD3\uD83C\uDFFE"]],"1f3ff":["1f9d3-1f3ff",50,41,15,["\uD83E\uDDD3\uD83C\uDFFF"]]},
		"1f9d4-200d-2640-fe0f":{"1f3fb":["1f9d4-1f3fb-200d-2640-fe0f",50,43,7,["\uD83E\uDDD4\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9d4-1f3fc-200d-2640-fe0f",50,44,7,["\uD83E\uDDD4\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9d4-1f3fd-200d-2640-fe0f",50,45,7,["\uD83E\uDDD4\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9d4-1f3fe-200d-2640-fe0f",50,46,7,["\uD83E\uDDD4\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9d4-1f3ff-200d-2640-fe0f",50,47,7,["\uD83E\uDDD4\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9d4-200d-2642-fe0f":{"1f3fb":["1f9d4-1f3fb-200d-2642-fe0f",50,49,7,["\uD83E\uDDD4\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9d4-1f3fc-200d-2642-fe0f",50,50,7,["\uD83E\uDDD4\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9d4-1f3fd-200d-2642-fe0f",50,51,7,["\uD83E\uDDD4\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9d4-1f3fe-200d-2642-fe0f",50,52,7,["\uD83E\uDDD4\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9d4-1f3ff-200d-2642-fe0f",50,53,7,["\uD83E\uDDD4\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9d4":{"1f3fb":["1f9d4-1f3fb",50,55,15,["\uD83E\uDDD4\uD83C\uDFFB"]],"1f3fc":["1f9d4-1f3fc",50,56,15,["\uD83E\uDDD4\uD83C\uDFFC"]],"1f3fd":["1f9d4-1f3fd",50,57,15,["\uD83E\uDDD4\uD83C\uDFFD"]],"1f3fe":["1f9d4-1f3fe",50,58,15,["\uD83E\uDDD4\uD83C\uDFFE"]],"1f3ff":["1f9d4-1f3ff",50,59,15,["\uD83E\uDDD4\uD83C\uDFFF"]]},
		"1f9d5":{"1f3fb":["1f9d5-1f3fb",51,1,15,["\uD83E\uDDD5\uD83C\uDFFB"]],"1f3fc":["1f9d5-1f3fc",51,2,15,["\uD83E\uDDD5\uD83C\uDFFC"]],"1f3fd":["1f9d5-1f3fd",51,3,15,["\uD83E\uDDD5\uD83C\uDFFD"]],"1f3fe":["1f9d5-1f3fe",51,4,15,["\uD83E\uDDD5\uD83C\uDFFE"]],"1f3ff":["1f9d5-1f3ff",51,5,15,["\uD83E\uDDD5\uD83C\uDFFF"]]},
		"1f9d6-200d-2640-fe0f":{"1f3fb":["1f9d6-1f3fb-200d-2640-fe0f",51,7,15,["\uD83E\uDDD6\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9d6-1f3fc-200d-2640-fe0f",51,8,15,["\uD83E\uDDD6\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9d6-1f3fd-200d-2640-fe0f",51,9,15,["\uD83E\uDDD6\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9d6-1f3fe-200d-2640-fe0f",51,10,15,["\uD83E\uDDD6\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9d6-1f3ff-200d-2640-fe0f",51,11,15,["\uD83E\uDDD6\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9d6-200d-2642-fe0f":{"1f3fb":["1f9d6-1f3fb-200d-2642-fe0f",51,13,15,["\uD83E\uDDD6\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83E\uDDD6\uD83C\uDFFB"]],"1f3fc":["1f9d6-1f3fc-200d-2642-fe0f",51,14,15,["\uD83E\uDDD6\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83E\uDDD6\uD83C\uDFFC"]],"1f3fd":["1f9d6-1f3fd-200d-2642-fe0f",51,15,15,["\uD83E\uDDD6\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83E\uDDD6\uD83C\uDFFD"]],"1f3fe":["1f9d6-1f3fe-200d-2642-fe0f",51,16,15,["\uD83E\uDDD6\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83E\uDDD6\uD83C\uDFFE"]],"1f3ff":["1f9d6-1f3ff-200d-2642-fe0f",51,17,15,["\uD83E\uDDD6\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83E\uDDD6\uD83C\uDFFF"]]},
		"1f9d7-200d-2640-fe0f":{"1f3fb":["1f9d7-1f3fb-200d-2640-fe0f",51,25,15,["\uD83E\uDDD7\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83E\uDDD7\uD83C\uDFFB"]],"1f3fc":["1f9d7-1f3fc-200d-2640-fe0f",51,26,15,["\uD83E\uDDD7\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83E\uDDD7\uD83C\uDFFC"]],"1f3fd":["1f9d7-1f3fd-200d-2640-fe0f",51,27,15,["\uD83E\uDDD7\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83E\uDDD7\uD83C\uDFFD"]],"1f3fe":["1f9d7-1f3fe-200d-2640-fe0f",51,28,15,["\uD83E\uDDD7\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83E\uDDD7\uD83C\uDFFE"]],"1f3ff":["1f9d7-1f3ff-200d-2640-fe0f",51,29,15,["\uD83E\uDDD7\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83E\uDDD7\uD83C\uDFFF"]]},
		"1f9d7-200d-2642-fe0f":{"1f3fb":["1f9d7-1f3fb-200d-2642-fe0f",51,31,15,["\uD83E\uDDD7\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9d7-1f3fc-200d-2642-fe0f",51,32,15,["\uD83E\uDDD7\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9d7-1f3fd-200d-2642-fe0f",51,33,15,["\uD83E\uDDD7\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9d7-1f3fe-200d-2642-fe0f",51,34,15,["\uD83E\uDDD7\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9d7-1f3ff-200d-2642-fe0f",51,35,15,["\uD83E\uDDD7\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9d8-200d-2640-fe0f":{"1f3fb":["1f9d8-1f3fb-200d-2640-fe0f",51,43,15,["\uD83E\uDDD8\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83E\uDDD8\uD83C\uDFFB"]],"1f3fc":["1f9d8-1f3fc-200d-2640-fe0f",51,44,15,["\uD83E\uDDD8\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83E\uDDD8\uD83C\uDFFC"]],"1f3fd":["1f9d8-1f3fd-200d-2640-fe0f",51,45,15,["\uD83E\uDDD8\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83E\uDDD8\uD83C\uDFFD"]],"1f3fe":["1f9d8-1f3fe-200d-2640-fe0f",51,46,15,["\uD83E\uDDD8\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83E\uDDD8\uD83C\uDFFE"]],"1f3ff":["1f9d8-1f3ff-200d-2640-fe0f",51,47,15,["\uD83E\uDDD8\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83E\uDDD8\uD83C\uDFFF"]]},
		"1f9d8-200d-2642-fe0f":{"1f3fb":["1f9d8-1f3fb-200d-2642-fe0f",51,49,15,["\uD83E\uDDD8\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9d8-1f3fc-200d-2642-fe0f",51,50,15,["\uD83E\uDDD8\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9d8-1f3fd-200d-2642-fe0f",51,51,15,["\uD83E\uDDD8\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9d8-1f3fe-200d-2642-fe0f",51,52,15,["\uD83E\uDDD8\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9d8-1f3ff-200d-2642-fe0f",51,53,15,["\uD83E\uDDD8\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9d9-200d-2640-fe0f":{"1f3fb":["1f9d9-1f3fb-200d-2640-fe0f",52,1,15,["\uD83E\uDDD9\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83E\uDDD9\uD83C\uDFFB"]],"1f3fc":["1f9d9-1f3fc-200d-2640-fe0f",52,2,15,["\uD83E\uDDD9\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83E\uDDD9\uD83C\uDFFC"]],"1f3fd":["1f9d9-1f3fd-200d-2640-fe0f",52,3,15,["\uD83E\uDDD9\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83E\uDDD9\uD83C\uDFFD"]],"1f3fe":["1f9d9-1f3fe-200d-2640-fe0f",52,4,15,["\uD83E\uDDD9\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83E\uDDD9\uD83C\uDFFE"]],"1f3ff":["1f9d9-1f3ff-200d-2640-fe0f",52,5,15,["\uD83E\uDDD9\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83E\uDDD9\uD83C\uDFFF"]]},
		"1f9d9-200d-2642-fe0f":{"1f3fb":["1f9d9-1f3fb-200d-2642-fe0f",52,7,15,["\uD83E\uDDD9\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9d9-1f3fc-200d-2642-fe0f",52,8,15,["\uD83E\uDDD9\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9d9-1f3fd-200d-2642-fe0f",52,9,15,["\uD83E\uDDD9\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9d9-1f3fe-200d-2642-fe0f",52,10,15,["\uD83E\uDDD9\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9d9-1f3ff-200d-2642-fe0f",52,11,15,["\uD83E\uDDD9\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9da-200d-2640-fe0f":{"1f3fb":["1f9da-1f3fb-200d-2640-fe0f",52,19,15,["\uD83E\uDDDA\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83E\uDDDA\uD83C\uDFFB"]],"1f3fc":["1f9da-1f3fc-200d-2640-fe0f",52,20,15,["\uD83E\uDDDA\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83E\uDDDA\uD83C\uDFFC"]],"1f3fd":["1f9da-1f3fd-200d-2640-fe0f",52,21,15,["\uD83E\uDDDA\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83E\uDDDA\uD83C\uDFFD"]],"1f3fe":["1f9da-1f3fe-200d-2640-fe0f",52,22,15,["\uD83E\uDDDA\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83E\uDDDA\uD83C\uDFFE"]],"1f3ff":["1f9da-1f3ff-200d-2640-fe0f",52,23,15,["\uD83E\uDDDA\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83E\uDDDA\uD83C\uDFFF"]]},
		"1f9da-200d-2642-fe0f":{"1f3fb":["1f9da-1f3fb-200d-2642-fe0f",52,25,15,["\uD83E\uDDDA\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9da-1f3fc-200d-2642-fe0f",52,26,15,["\uD83E\uDDDA\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9da-1f3fd-200d-2642-fe0f",52,27,15,["\uD83E\uDDDA\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9da-1f3fe-200d-2642-fe0f",52,28,15,["\uD83E\uDDDA\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9da-1f3ff-200d-2642-fe0f",52,29,15,["\uD83E\uDDDA\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9db-200d-2640-fe0f":{"1f3fb":["1f9db-1f3fb-200d-2640-fe0f",52,37,15,["\uD83E\uDDDB\uD83C\uDFFB\u200D\u2640\uFE0F","\uD83E\uDDDB\uD83C\uDFFB"]],"1f3fc":["1f9db-1f3fc-200d-2640-fe0f",52,38,15,["\uD83E\uDDDB\uD83C\uDFFC\u200D\u2640\uFE0F","\uD83E\uDDDB\uD83C\uDFFC"]],"1f3fd":["1f9db-1f3fd-200d-2640-fe0f",52,39,15,["\uD83E\uDDDB\uD83C\uDFFD\u200D\u2640\uFE0F","\uD83E\uDDDB\uD83C\uDFFD"]],"1f3fe":["1f9db-1f3fe-200d-2640-fe0f",52,40,15,["\uD83E\uDDDB\uD83C\uDFFE\u200D\u2640\uFE0F","\uD83E\uDDDB\uD83C\uDFFE"]],"1f3ff":["1f9db-1f3ff-200d-2640-fe0f",52,41,15,["\uD83E\uDDDB\uD83C\uDFFF\u200D\u2640\uFE0F","\uD83E\uDDDB\uD83C\uDFFF"]]},
		"1f9db-200d-2642-fe0f":{"1f3fb":["1f9db-1f3fb-200d-2642-fe0f",52,43,15,["\uD83E\uDDDB\uD83C\uDFFB\u200D\u2642\uFE0F"]],"1f3fc":["1f9db-1f3fc-200d-2642-fe0f",52,44,15,["\uD83E\uDDDB\uD83C\uDFFC\u200D\u2642\uFE0F"]],"1f3fd":["1f9db-1f3fd-200d-2642-fe0f",52,45,15,["\uD83E\uDDDB\uD83C\uDFFD\u200D\u2642\uFE0F"]],"1f3fe":["1f9db-1f3fe-200d-2642-fe0f",52,46,15,["\uD83E\uDDDB\uD83C\uDFFE\u200D\u2642\uFE0F"]],"1f3ff":["1f9db-1f3ff-200d-2642-fe0f",52,47,15,["\uD83E\uDDDB\uD83C\uDFFF\u200D\u2642\uFE0F"]]},
		"1f9dc-200d-2640-fe0f":{"1f3fb":["1f9dc-1f3fb-200d-2640-fe0f",52,55,15,["\uD83E\uDDDC\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9dc-1f3fc-200d-2640-fe0f",52,56,15,["\uD83E\uDDDC\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9dc-1f3fd-200d-2640-fe0f",52,57,15,["\uD83E\uDDDC\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9dc-1f3fe-200d-2640-fe0f",52,58,15,["\uD83E\uDDDC\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9dc-1f3ff-200d-2640-fe0f",52,59,15,["\uD83E\uDDDC\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9dc-200d-2642-fe0f":{"1f3fb":["1f9dc-1f3fb-200d-2642-fe0f",53,1,15,["\uD83E\uDDDC\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83E\uDDDC\uD83C\uDFFB"]],"1f3fc":["1f9dc-1f3fc-200d-2642-fe0f",53,2,15,["\uD83E\uDDDC\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83E\uDDDC\uD83C\uDFFC"]],"1f3fd":["1f9dc-1f3fd-200d-2642-fe0f",53,3,15,["\uD83E\uDDDC\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83E\uDDDC\uD83C\uDFFD"]],"1f3fe":["1f9dc-1f3fe-200d-2642-fe0f",53,4,15,["\uD83E\uDDDC\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83E\uDDDC\uD83C\uDFFE"]],"1f3ff":["1f9dc-1f3ff-200d-2642-fe0f",53,5,15,["\uD83E\uDDDC\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83E\uDDDC\uD83C\uDFFF"]]},
		"1f9dd-200d-2640-fe0f":{"1f3fb":["1f9dd-1f3fb-200d-2640-fe0f",53,13,15,["\uD83E\uDDDD\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["1f9dd-1f3fc-200d-2640-fe0f",53,14,15,["\uD83E\uDDDD\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["1f9dd-1f3fd-200d-2640-fe0f",53,15,15,["\uD83E\uDDDD\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["1f9dd-1f3fe-200d-2640-fe0f",53,16,15,["\uD83E\uDDDD\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["1f9dd-1f3ff-200d-2640-fe0f",53,17,15,["\uD83E\uDDDD\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"1f9dd-200d-2642-fe0f":{"1f3fb":["1f9dd-1f3fb-200d-2642-fe0f",53,19,15,["\uD83E\uDDDD\uD83C\uDFFB\u200D\u2642\uFE0F","\uD83E\uDDDD\uD83C\uDFFB"]],"1f3fc":["1f9dd-1f3fc-200d-2642-fe0f",53,20,15,["\uD83E\uDDDD\uD83C\uDFFC\u200D\u2642\uFE0F","\uD83E\uDDDD\uD83C\uDFFC"]],"1f3fd":["1f9dd-1f3fd-200d-2642-fe0f",53,21,15,["\uD83E\uDDDD\uD83C\uDFFD\u200D\u2642\uFE0F","\uD83E\uDDDD\uD83C\uDFFD"]],"1f3fe":["1f9dd-1f3fe-200d-2642-fe0f",53,22,15,["\uD83E\uDDDD\uD83C\uDFFE\u200D\u2642\uFE0F","\uD83E\uDDDD\uD83C\uDFFE"]],"1f3ff":["1f9dd-1f3ff-200d-2642-fe0f",53,23,15,["\uD83E\uDDDD\uD83C\uDFFF\u200D\u2642\uFE0F","\uD83E\uDDDD\uD83C\uDFFF"]]},
		"261d-fe0f":{"1f3fb":["261d-1f3fb",55,55,15,["\u261D\uD83C\uDFFB"]],"1f3fc":["261d-1f3fc",55,56,15,["\u261D\uD83C\uDFFC"]],"1f3fd":["261d-1f3fd",55,57,15,["\u261D\uD83C\uDFFD"]],"1f3fe":["261d-1f3fe",55,58,15,["\u261D\uD83C\uDFFE"]],"1f3ff":["261d-1f3ff",55,59,15,["\u261D\uD83C\uDFFF"]]},
		"26f9-fe0f-200d-2640-fe0f":{"1f3fb":["26f9-1f3fb-200d-2640-fe0f",57,10,15,["\u26F9\uD83C\uDFFB\u200D\u2640\uFE0F"]],"1f3fc":["26f9-1f3fc-200d-2640-fe0f",57,11,15,["\u26F9\uD83C\uDFFC\u200D\u2640\uFE0F"]],"1f3fd":["26f9-1f3fd-200d-2640-fe0f",57,12,15,["\u26F9\uD83C\uDFFD\u200D\u2640\uFE0F"]],"1f3fe":["26f9-1f3fe-200d-2640-fe0f",57,13,15,["\u26F9\uD83C\uDFFE\u200D\u2640\uFE0F"]],"1f3ff":["26f9-1f3ff-200d-2640-fe0f",57,14,15,["\u26F9\uD83C\uDFFF\u200D\u2640\uFE0F"]]},
		"26f9-fe0f-200d-2642-fe0f":{"1f3fb":["26f9-1f3fb-200d-2642-fe0f",57,16,15,["\u26F9\uD83C\uDFFB\u200D\u2642\uFE0F","\u26F9\uD83C\uDFFB"]],"1f3fc":["26f9-1f3fc-200d-2642-fe0f",57,17,15,["\u26F9\uD83C\uDFFC\u200D\u2642\uFE0F","\u26F9\uD83C\uDFFC"]],"1f3fd":["26f9-1f3fd-200d-2642-fe0f",57,18,15,["\u26F9\uD83C\uDFFD\u200D\u2642\uFE0F","\u26F9\uD83C\uDFFD"]],"1f3fe":["26f9-1f3fe-200d-2642-fe0f",57,19,15,["\u26F9\uD83C\uDFFE\u200D\u2642\uFE0F","\u26F9\uD83C\uDFFE"]],"1f3ff":["26f9-1f3ff-200d-2642-fe0f",57,20,15,["\u26F9\uD83C\uDFFF\u200D\u2642\uFE0F","\u26F9\uD83C\uDFFF"]]},
		"270a":{"1f3fb":["270a-1f3fb",57,34,15,["\u270A\uD83C\uDFFB"]],"1f3fc":["270a-1f3fc",57,35,15,["\u270A\uD83C\uDFFC"]],"1f3fd":["270a-1f3fd",57,36,15,["\u270A\uD83C\uDFFD"]],"1f3fe":["270a-1f3fe",57,37,15,["\u270A\uD83C\uDFFE"]],"1f3ff":["270a-1f3ff",57,38,15,["\u270A\uD83C\uDFFF"]]},
		"270b":{"1f3fb":["270b-1f3fb",57,40,15,["\u270B\uD83C\uDFFB"]],"1f3fc":["270b-1f3fc",57,41,15,["\u270B\uD83C\uDFFC"]],"1f3fd":["270b-1f3fd",57,42,15,["\u270B\uD83C\uDFFD"]],"1f3fe":["270b-1f3fe",57,43,15,["\u270B\uD83C\uDFFE"]],"1f3ff":["270b-1f3ff",57,44,15,["\u270B\uD83C\uDFFF"]]},
		"270c-fe0f":{"1f3fb":["270c-1f3fb",57,46,15,["\u270C\uD83C\uDFFB"]],"1f3fc":["270c-1f3fc",57,47,15,["\u270C\uD83C\uDFFC"]],"1f3fd":["270c-1f3fd",57,48,15,["\u270C\uD83C\uDFFD"]],"1f3fe":["270c-1f3fe",57,49,15,["\u270C\uD83C\uDFFE"]],"1f3ff":["270c-1f3ff",57,50,15,["\u270C\uD83C\uDFFF"]]},
		"270d-fe0f":{"1f3fb":["270d-1f3fb",57,52,15,["\u270D\uD83C\uDFFB"]],"1f3fc":["270d-1f3fc",57,53,15,["\u270D\uD83C\uDFFC"]],"1f3fd":["270d-1f3fd",57,54,15,["\u270D\uD83C\uDFFD"]],"1f3fe":["270d-1f3fe",57,55,15,["\u270D\uD83C\uDFFE"]],"1f3ff":["270d-1f3ff",57,56,15,["\u270D\uD83C\uDFFF"]]}
	};
	/** @private */
	emoji.prototype.obsoletes_data = {
		"1f3c3-200d-2642-fe0f":["1f3c3",8,34,15],
		"1f3c3-1f3fb-200d-2642-fe0f":["1f3c3-1f3fb",8,35,15],
		"1f3c3-1f3fc-200d-2642-fe0f":["1f3c3-1f3fc",8,36,15],
		"1f3c3-1f3fd-200d-2642-fe0f":["1f3c3-1f3fd",8,37,15],
		"1f3c3-1f3fe-200d-2642-fe0f":["1f3c3-1f3fe",8,38,15],
		"1f3c3-1f3ff-200d-2642-fe0f":["1f3c3-1f3ff",8,39,15],
		"1f3c4-200d-2642-fe0f":["1f3c4",8,52,15],
		"1f3c4-1f3fb-200d-2642-fe0f":["1f3c4-1f3fb",8,53,15],
		"1f3c4-1f3fc-200d-2642-fe0f":["1f3c4-1f3fc",8,54,15],
		"1f3c4-1f3fd-200d-2642-fe0f":["1f3c4-1f3fd",8,55,15],
		"1f3c4-1f3fe-200d-2642-fe0f":["1f3c4-1f3fe",8,56,15],
		"1f3c4-1f3ff-200d-2642-fe0f":["1f3c4-1f3ff",8,57,15],
		"1f3ca-200d-2642-fe0f":["1f3ca",9,20,15],
		"1f3ca-1f3fb-200d-2642-fe0f":["1f3ca-1f3fb",9,21,15],
		"1f3ca-1f3fc-200d-2642-fe0f":["1f3ca-1f3fc",9,22,15],
		"1f3ca-1f3fd-200d-2642-fe0f":["1f3ca-1f3fd",9,23,15],
		"1f3ca-1f3fe-200d-2642-fe0f":["1f3ca-1f3fe",9,24,15],
		"1f3ca-1f3ff-200d-2642-fe0f":["1f3ca-1f3ff",9,25,15],
		"1f3cb-fe0f-200d-2642-fe0f":["1f3cb-fe0f",9,38,15],
		"1f3cb-1f3fb-200d-2642-fe0f":["1f3cb-1f3fb",9,39,15],
		"1f3cb-1f3fc-200d-2642-fe0f":["1f3cb-1f3fc",9,40,15],
		"1f3cb-1f3fd-200d-2642-fe0f":["1f3cb-1f3fd",9,41,15],
		"1f3cb-1f3fe-200d-2642-fe0f":["1f3cb-1f3fe",9,42,15],
		"1f3cb-1f3ff-200d-2642-fe0f":["1f3cb-1f3ff",9,43,15],
		"1f3cc-fe0f-200d-2642-fe0f":["1f3cc-fe0f",9,56,15],
		"1f3cc-1f3fb-200d-2642-fe0f":["1f3cc-1f3fb",9,57,15],
		"1f3cc-1f3fc-200d-2642-fe0f":["1f3cc-1f3fc",9,58,15],
		"1f3cc-1f3fd-200d-2642-fe0f":["1f3cc-1f3fd",9,59,15],
		"1f3cc-1f3fe-200d-2642-fe0f":["1f3cc-1f3fe",10,0,15],
		"1f3cc-1f3ff-200d-2642-fe0f":["1f3cc-1f3ff",10,1,15],
		"1f468-200d-1f469-200d-1f466":["1f46a",22,0,15],
		"1f46e-200d-2642-fe0f":["1f46e",23,31,15],
		"1f46e-1f3fb-200d-2642-fe0f":["1f46e-1f3fb",23,32,15],
		"1f46e-1f3fc-200d-2642-fe0f":["1f46e-1f3fc",23,33,15],
		"1f46e-1f3fd-200d-2642-fe0f":["1f46e-1f3fd",23,34,15],
		"1f46e-1f3fe-200d-2642-fe0f":["1f46e-1f3fe",23,35,15],
		"1f46e-1f3ff-200d-2642-fe0f":["1f46e-1f3ff",23,36,15],
		"1f46f-200d-2640-fe0f":["1f46f",23,39,15],
		"1f471-200d-2642-fe0f":["1f471",24,10,15],
		"1f471-1f3fb-200d-2642-fe0f":["1f471-1f3fb",24,11,15],
		"1f471-1f3fc-200d-2642-fe0f":["1f471-1f3fc",24,12,15],
		"1f471-1f3fd-200d-2642-fe0f":["1f471-1f3fd",24,13,15],
		"1f471-1f3fe-200d-2642-fe0f":["1f471-1f3fe",24,14,15],
		"1f471-1f3ff-200d-2642-fe0f":["1f471-1f3ff",24,15,15],
		"1f473-200d-2642-fe0f":["1f473",24,34,15],
		"1f473-1f3fb-200d-2642-fe0f":["1f473-1f3fb",24,35,15],
		"1f473-1f3fc-200d-2642-fe0f":["1f473-1f3fc",24,36,15],
		"1f473-1f3fd-200d-2642-fe0f":["1f473-1f3fd",24,37,15],
		"1f473-1f3fe-200d-2642-fe0f":["1f473-1f3fe",24,38,15],
		"1f473-1f3ff-200d-2642-fe0f":["1f473-1f3ff",24,39,15],
		"1f477-200d-2642-fe0f":["1f477",25,10,15],
		"1f477-1f3fb-200d-2642-fe0f":["1f477-1f3fb",25,11,15],
		"1f477-1f3fc-200d-2642-fe0f":["1f477-1f3fc",25,12,15],
		"1f477-1f3fd-200d-2642-fe0f":["1f477-1f3fd",25,13,15],
		"1f477-1f3fe-200d-2642-fe0f":["1f477-1f3fe",25,14,15],
		"1f477-1f3ff-200d-2642-fe0f":["1f477-1f3ff",25,15,15],
		"1f481-200d-2640-fe0f":["1f481",25,47,15],
		"1f481-1f3fb-200d-2640-fe0f":["1f481-1f3fb",25,48,15],
		"1f481-1f3fc-200d-2640-fe0f":["1f481-1f3fc",25,49,15],
		"1f481-1f3fd-200d-2640-fe0f":["1f481-1f3fd",25,50,15],
		"1f481-1f3fe-200d-2640-fe0f":["1f481-1f3fe",25,51,15],
		"1f481-1f3ff-200d-2640-fe0f":["1f481-1f3ff",25,52,15],
		"1f482-200d-2642-fe0f":["1f482",26,5,15],
		"1f482-1f3fb-200d-2642-fe0f":["1f482-1f3fb",26,6,15],
		"1f482-1f3fc-200d-2642-fe0f":["1f482-1f3fc",26,7,15],
		"1f482-1f3fd-200d-2642-fe0f":["1f482-1f3fd",26,8,15],
		"1f482-1f3fe-200d-2642-fe0f":["1f482-1f3fe",26,9,15],
		"1f482-1f3ff-200d-2642-fe0f":["1f482-1f3ff",26,10,15],
		"1f486-200d-2640-fe0f":["1f486",26,36,15],
		"1f486-1f3fb-200d-2640-fe0f":["1f486-1f3fb",26,37,15],
		"1f486-1f3fc-200d-2640-fe0f":["1f486-1f3fc",26,38,15],
		"1f486-1f3fd-200d-2640-fe0f":["1f486-1f3fd",26,39,15],
		"1f486-1f3fe-200d-2640-fe0f":["1f486-1f3fe",26,40,15],
		"1f486-1f3ff-200d-2640-fe0f":["1f486-1f3ff",26,41,15],
		"1f487-200d-2640-fe0f":["1f487",26,54,15],
		"1f487-1f3fb-200d-2640-fe0f":["1f487-1f3fb",26,55,15],
		"1f487-1f3fc-200d-2640-fe0f":["1f487-1f3fc",26,56,15],
		"1f487-1f3fd-200d-2640-fe0f":["1f487-1f3fd",26,57,15],
		"1f487-1f3fe-200d-2640-fe0f":["1f487-1f3fe",26,58,15],
		"1f487-1f3ff-200d-2640-fe0f":["1f487-1f3ff",26,59,15],
		"1f575-fe0f-200d-2642-fe0f":["1f575-fe0f",31,47,15],
		"1f575-1f3fb-200d-2642-fe0f":["1f575-1f3fb",31,48,15],
		"1f575-1f3fc-200d-2642-fe0f":["1f575-1f3fc",31,49,15],
		"1f575-1f3fd-200d-2642-fe0f":["1f575-1f3fd",31,50,15],
		"1f575-1f3fe-200d-2642-fe0f":["1f575-1f3fe",31,51,15],
		"1f575-1f3ff-200d-2642-fe0f":["1f575-1f3ff",31,52,15],
		"1f645-200d-2640-fe0f":["1f645",34,16,15],
		"1f645-1f3fb-200d-2640-fe0f":["1f645-1f3fb",34,17,15],
		"1f645-1f3fc-200d-2640-fe0f":["1f645-1f3fc",34,18,15],
		"1f645-1f3fd-200d-2640-fe0f":["1f645-1f3fd",34,19,15],
		"1f645-1f3fe-200d-2640-fe0f":["1f645-1f3fe",34,20,15],
		"1f645-1f3ff-200d-2640-fe0f":["1f645-1f3ff",34,21,15],
		"1f646-200d-2640-fe0f":["1f646",34,34,15],
		"1f646-1f3fb-200d-2640-fe0f":["1f646-1f3fb",34,35,15],
		"1f646-1f3fc-200d-2640-fe0f":["1f646-1f3fc",34,36,15],
		"1f646-1f3fd-200d-2640-fe0f":["1f646-1f3fd",34,37,15],
		"1f646-1f3fe-200d-2640-fe0f":["1f646-1f3fe",34,38,15],
		"1f646-1f3ff-200d-2640-fe0f":["1f646-1f3ff",34,39,15],
		"1f647-200d-2642-fe0f":["1f647",34,52,15],
		"1f647-1f3fb-200d-2642-fe0f":["1f647-1f3fb",34,53,15],
		"1f647-1f3fc-200d-2642-fe0f":["1f647-1f3fc",34,54,15],
		"1f647-1f3fd-200d-2642-fe0f":["1f647-1f3fd",34,55,15],
		"1f647-1f3fe-200d-2642-fe0f":["1f647-1f3fe",34,56,15],
		"1f647-1f3ff-200d-2642-fe0f":["1f647-1f3ff",34,57,15],
		"1f64b-200d-2640-fe0f":["1f64b",35,13,15],
		"1f64b-1f3fb-200d-2640-fe0f":["1f64b-1f3fb",35,14,15],
		"1f64b-1f3fc-200d-2640-fe0f":["1f64b-1f3fc",35,15,15],
		"1f64b-1f3fd-200d-2640-fe0f":["1f64b-1f3fd",35,16,15],
		"1f64b-1f3fe-200d-2640-fe0f":["1f64b-1f3fe",35,17,15],
		"1f64b-1f3ff-200d-2640-fe0f":["1f64b-1f3ff",35,18,15],
		"1f64d-200d-2640-fe0f":["1f64d",35,37,15],
		"1f64d-1f3fb-200d-2640-fe0f":["1f64d-1f3fb",35,38,15],
		"1f64d-1f3fc-200d-2640-fe0f":["1f64d-1f3fc",35,39,15],
		"1f64d-1f3fd-200d-2640-fe0f":["1f64d-1f3fd",35,40,15],
		"1f64d-1f3fe-200d-2640-fe0f":["1f64d-1f3fe",35,41,15],
		"1f64d-1f3ff-200d-2640-fe0f":["1f64d-1f3ff",35,42,15],
		"1f64e-200d-2640-fe0f":["1f64e",35,55,15],
		"1f64e-1f3fb-200d-2640-fe0f":["1f64e-1f3fb",35,56,15],
		"1f64e-1f3fc-200d-2640-fe0f":["1f64e-1f3fc",35,57,15],
		"1f64e-1f3fd-200d-2640-fe0f":["1f64e-1f3fd",35,58,15],
		"1f64e-1f3fe-200d-2640-fe0f":["1f64e-1f3fe",35,59,15],
		"1f64e-1f3ff-200d-2640-fe0f":["1f64e-1f3ff",36,0,15],
		"1f6a3-200d-2642-fe0f":["1f6a3",36,54,15],
		"1f6a3-1f3fb-200d-2642-fe0f":["1f6a3-1f3fb",36,55,15],
		"1f6a3-1f3fc-200d-2642-fe0f":["1f6a3-1f3fc",36,56,15],
		"1f6a3-1f3fd-200d-2642-fe0f":["1f6a3-1f3fd",36,57,15],
		"1f6a3-1f3fe-200d-2642-fe0f":["1f6a3-1f3fe",36,58,15],
		"1f6a3-1f3ff-200d-2642-fe0f":["1f6a3-1f3ff",36,59,15],
		"1f6b4-200d-2642-fe0f":["1f6b4",37,28,15],
		"1f6b4-1f3fb-200d-2642-fe0f":["1f6b4-1f3fb",37,29,15],
		"1f6b4-1f3fc-200d-2642-fe0f":["1f6b4-1f3fc",37,30,15],
		"1f6b4-1f3fd-200d-2642-fe0f":["1f6b4-1f3fd",37,31,15],
		"1f6b4-1f3fe-200d-2642-fe0f":["1f6b4-1f3fe",37,32,15],
		"1f6b4-1f3ff-200d-2642-fe0f":["1f6b4-1f3ff",37,33,15],
		"1f6b5-200d-2642-fe0f":["1f6b5",37,46,15],
		"1f6b5-1f3fb-200d-2642-fe0f":["1f6b5-1f3fb",37,47,15],
		"1f6b5-1f3fc-200d-2642-fe0f":["1f6b5-1f3fc",37,48,15],
		"1f6b5-1f3fd-200d-2642-fe0f":["1f6b5-1f3fd",37,49,15],
		"1f6b5-1f3fe-200d-2642-fe0f":["1f6b5-1f3fe",37,50,15],
		"1f6b5-1f3ff-200d-2642-fe0f":["1f6b5-1f3ff",37,51,15],
		"1f6b6-200d-2642-fe0f":["1f6b6",38,4,15],
		"1f6b6-1f3fb-200d-2642-fe0f":["1f6b6-1f3fb",38,5,15],
		"1f6b6-1f3fc-200d-2642-fe0f":["1f6b6-1f3fc",38,6,15],
		"1f6b6-1f3fd-200d-2642-fe0f":["1f6b6-1f3fd",38,7,15],
		"1f6b6-1f3fe-200d-2642-fe0f":["1f6b6-1f3fe",38,8,15],
		"1f6b6-1f3ff-200d-2642-fe0f":["1f6b6-1f3ff",38,9,15],
		"1f9d6-200d-2642-fe0f":["1f9d6",51,18,15],
		"1f9d6-1f3fb-200d-2642-fe0f":["1f9d6-1f3fb",51,19,15],
		"1f9d6-1f3fc-200d-2642-fe0f":["1f9d6-1f3fc",51,20,15],
		"1f9d6-1f3fd-200d-2642-fe0f":["1f9d6-1f3fd",51,21,15],
		"1f9d6-1f3fe-200d-2642-fe0f":["1f9d6-1f3fe",51,22,15],
		"1f9d6-1f3ff-200d-2642-fe0f":["1f9d6-1f3ff",51,23,15],
		"1f9d7-200d-2640-fe0f":["1f9d7",51,36,15],
		"1f9d7-1f3fb-200d-2640-fe0f":["1f9d7-1f3fb",51,37,15],
		"1f9d7-1f3fc-200d-2640-fe0f":["1f9d7-1f3fc",51,38,15],
		"1f9d7-1f3fd-200d-2640-fe0f":["1f9d7-1f3fd",51,39,15],
		"1f9d7-1f3fe-200d-2640-fe0f":["1f9d7-1f3fe",51,40,15],
		"1f9d7-1f3ff-200d-2640-fe0f":["1f9d7-1f3ff",51,41,15],
		"1f9d8-200d-2640-fe0f":["1f9d8",51,54,15],
		"1f9d8-1f3fb-200d-2640-fe0f":["1f9d8-1f3fb",51,55,15],
		"1f9d8-1f3fc-200d-2640-fe0f":["1f9d8-1f3fc",51,56,15],
		"1f9d8-1f3fd-200d-2640-fe0f":["1f9d8-1f3fd",51,57,15],
		"1f9d8-1f3fe-200d-2640-fe0f":["1f9d8-1f3fe",51,58,15],
		"1f9d8-1f3ff-200d-2640-fe0f":["1f9d8-1f3ff",51,59,15],
		"1f9d9-200d-2640-fe0f":["1f9d9",52,12,15],
		"1f9d9-1f3fb-200d-2640-fe0f":["1f9d9-1f3fb",52,13,15],
		"1f9d9-1f3fc-200d-2640-fe0f":["1f9d9-1f3fc",52,14,15],
		"1f9d9-1f3fd-200d-2640-fe0f":["1f9d9-1f3fd",52,15,15],
		"1f9d9-1f3fe-200d-2640-fe0f":["1f9d9-1f3fe",52,16,15],
		"1f9d9-1f3ff-200d-2640-fe0f":["1f9d9-1f3ff",52,17,15],
		"1f9da-200d-2640-fe0f":["1f9da",52,30,15],
		"1f9da-1f3fb-200d-2640-fe0f":["1f9da-1f3fb",52,31,15],
		"1f9da-1f3fc-200d-2640-fe0f":["1f9da-1f3fc",52,32,15],
		"1f9da-1f3fd-200d-2640-fe0f":["1f9da-1f3fd",52,33,15],
		"1f9da-1f3fe-200d-2640-fe0f":["1f9da-1f3fe",52,34,15],
		"1f9da-1f3ff-200d-2640-fe0f":["1f9da-1f3ff",52,35,15],
		"1f9db-200d-2640-fe0f":["1f9db",52,48,15],
		"1f9db-1f3fb-200d-2640-fe0f":["1f9db-1f3fb",52,49,15],
		"1f9db-1f3fc-200d-2640-fe0f":["1f9db-1f3fc",52,50,15],
		"1f9db-1f3fd-200d-2640-fe0f":["1f9db-1f3fd",52,51,15],
		"1f9db-1f3fe-200d-2640-fe0f":["1f9db-1f3fe",52,52,15],
		"1f9db-1f3ff-200d-2640-fe0f":["1f9db-1f3ff",52,53,15],
		"1f9dc-200d-2642-fe0f":["1f9dc",53,6,15],
		"1f9dc-1f3fb-200d-2642-fe0f":["1f9dc-1f3fb",53,7,15],
		"1f9dc-1f3fc-200d-2642-fe0f":["1f9dc-1f3fc",53,8,15],
		"1f9dc-1f3fd-200d-2642-fe0f":["1f9dc-1f3fd",53,9,15],
		"1f9dc-1f3fe-200d-2642-fe0f":["1f9dc-1f3fe",53,10,15],
		"1f9dc-1f3ff-200d-2642-fe0f":["1f9dc-1f3ff",53,11,15],
		"1f9dd-200d-2642-fe0f":["1f9dd",53,24,15],
		"1f9dd-1f3fb-200d-2642-fe0f":["1f9dd-1f3fb",53,25,15],
		"1f9dd-1f3fc-200d-2642-fe0f":["1f9dd-1f3fc",53,26,15],
		"1f9dd-1f3fd-200d-2642-fe0f":["1f9dd-1f3fd",53,27,15],
		"1f9dd-1f3fe-200d-2642-fe0f":["1f9dd-1f3fe",53,28,15],
		"1f9dd-1f3ff-200d-2642-fe0f":["1f9dd-1f3ff",53,29,15],
		"1f9de-200d-2642-fe0f":["1f9de",53,32,15],
		"1f9df-200d-2642-fe0f":["1f9df",53,35,15],
		"26f9-fe0f-200d-2642-fe0f":["26f9-fe0f",57,21,15],
		"26f9-1f3fb-200d-2642-fe0f":["26f9-1f3fb",57,22,15],
		"26f9-1f3fc-200d-2642-fe0f":["26f9-1f3fc",57,23,15],
		"26f9-1f3fd-200d-2642-fe0f":["26f9-1f3fd",57,24,15],
		"26f9-1f3fe-200d-2642-fe0f":["26f9-1f3fe",57,25,15],
		"26f9-1f3ff-200d-2642-fe0f":["26f9-1f3ff",57,26,15]
	};


	// export
	if (typeof exports !== 'undefined'){
		if (typeof module !== 'undefined' && module.exports){
			exports = module.exports = emoji;
		}
		exports.EmojiConvertor = emoji;
	}else if (typeof define === 'function' && define.amd){
		define(function() { return emoji; })
	}else{
		root.EmojiConvertor = emoji;
	}

}).call(function(){
	return this || (typeof window !== 'undefined' ? window : global);
}());
