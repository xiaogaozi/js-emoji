
describe("Correctly supports different modes", function(){

	//console.log("modes", emoji.inits, emoji.replace_mode);

	var emoji = new EmojiConvertor();

	emoji.img_set = 'apple';
	emoji.img_sets.apple.path = '/';
	emoji.img_sets.apple.sheet = '/sheet.png';
	emoji.colons_mode = false;
	emoji.text_mode = false;
	emoji.include_title = false;
	emoji.allow_native = false;
	emoji.avoid_ms_emoji = true;

	it("Uses spritesheets with CSS background-sizing support", function(){

		emoji.use_sheet = true;
		emoji.use_css_imgs = false;

		expect(emoji.replace_colons(':cloud:')).toBe(emoji_sheet_cp_path('2601-fe0f', '/sheet.png', '93.22033898305085% 76.27118644067797%'));
	});

	it("Uses CSS classes with CSS background-sizing support", function(){

		emoji.use_sheet = false;
		emoji.use_css_imgs = true;

		expect(emoji.replace_colons(':cloud:')).toBe('<span class="emoji emoji-2601-fe0f" data-codepoints="2601-fe0f"></span>');
	});

	it("Uses individual images with CSS background-sizing support", function(){

		emoji.use_sheet = false;
		emoji.use_css_imgs = false;

		expect(emoji.replace_colons(':cloud:')).toBe('<span class="emoji emoji-sizer" style="background-image:url(/2601-fe0f.png)" data-codepoints="2601-fe0f"></span>');
	});

	it("Allows explicitly overriding the replacement mode", function(){

		// we have an explicit override test here, because 1) it's in the docs and 2) it was previously broken (for 'img' mode only)
		var e = new EmojiConvertor();
		e.img_set = 'apple';
		e.img_sets.apple.path = '/';
		e.replace_mode = 'img';

		expect(e.replace_colons(':smile:')).toBe('<img src="/1f604.png" class="emoji" data-codepoints="1f604" />');
	});


});

