var pointer = []; //used to reference vars dynamically
var conversation = []; //used to point to conversations dynamically

var i = 0,
    windows = '',
    ogSync = Backbone.sync,
    com_contacts = null,
    com_contact_requests = null,
    com_groups = null,
    com_conversations = null;

/////////////////////////////////////////////////////////////////////////////////////////
function loadXMLDoc() {

    var xmlhttp,
        oldresult,
        newresult,
        oldlength = 0,
        newlength,
        convo,
        msg,
        url;
        
    if (navigator.appVersion.indexOf("Win") !== -1) {
        windows = '&windows=true';
    }
    
    url = [com_chat_url, // defined in com_bar.phtml
			"?",
			i,
			windows,
			'&auth_pk=',
			com_auth_pk, // defined in com_bar.phtml
			'&token=',
			com_auth_token, // defined in com_bar.phtml
			'&post_date=',
			com_conversations.getLastDate()].join('');
                

    if (window.XDomainRequest) { // xdr IE 8

        xmlhttp = new XDomainRequest();

        xmlhttp.onload = function () {
        
            orsc(xmlhttp.responseText);
            
            setTimeout(function () {
            
                loadXMLDoc();
                
            },500);
            
        };
        
        xmlhttp.open("GET",url);
        xmlhttp.send();
        
    } else {// non IE 8
    
        xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET",url);
        xmlhttp.withCredentials = true;
        
        xmlhttp.onreadystatechange = function () {
        
            if (xmlhttp.readyState === 3) {
                orsc(xmlhttp.responseText);
            } else if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                loadXMLDoc();
            }
            
        };
        
        xmlhttp.send();

    }
    
    i++;
    
	function orsc(newresult) {
		newlength = newresult.length;

		if (newlength > oldlength) {
			var arr = $.parseJSON(newresult.substring(oldlength)),convo,item;
			$.each( arr, function(k,v) {
		
				if (v.special_group_sender_pk) {
					item = 'cg' + v.special_group_sender_pk + '-' + v.group_pk; 
				} else {
					item = v.group_pk ? 'g'+v.group_pk : v.recipient_pk;
				}
			
				var recipient_pk,name;
			
				if (v.special_group_sender_pk) {
					recipient_pk = 'cg'+v.special_group_sender_pk+'-'+v.group_pk;
					name = v.recipient_name;
				} else {
					recipient_pk = v.recipient_pk != 0 ? v.recipient_pk : 'g'+v.group_pk;
					name = v.group_pk ? v.group_name : v.recipient_name;
				}
			
				if ( convo = com_conversations.get(item) ) {
					var msgs = convo.get('messagesCollection'),
						data = {
							pk: v.pk,
							group_pk: v.group_pk || null,
							group_name: v.group_name || null,
							recipient_pk: v.recipient_pk,
							recipient_name: name,
							messages_body_pk: v.messages_body_pk,
							body: v.body,
							sent: v.sent,
							sent_datetime: v.sent_datetime,
							viewed_datetime: v.viewed_datetime
						};
				
					if ( msg = msgs.get(v.pk) ) {
						msg.set(data);
					} else {
						msgs.add(data,{
							silent:true,
							merge:true
						});
					}
				
				} else {
					com_conversations.add({
						pk: v.pk,
						messages_body_pk: v.messages_body_pk,
						recipient_pk: recipient_pk, 
						group_pk: v.group_pk || null,
						recipient_name: name,
						sent: v.sent,
						special_group_sender_pk: v.special_group_sender_pk,
						body: v.body,
						sent_datetime: v.sent_datetime, 
						viewed_datetime: v.viewed_datetime
					});
				
				}
			
			
				if ( pointer['com_conversations_view'] ) {
					pointer['com_conversations_view'].updateList();
				}
			
				if ( $('#com_pop_messages_list').exists() ) {
					pointer['viewMessages'].updateList();
				}
			
				com_conversations.checkforunread();
			
			});
		}
	
		oldresult = newresult;
		oldlength = oldresult.length;
	
	}

}


/////////////////////////////////////////////////////////////////////////////////////////

$.ajaxPrefilter( function( options, originalOptions, jqXHR ) {

    options.xhrFields = {
        withCredentials: true
    };
    
    options.timeout = 70000;
    
});

Backbone.sync = function(method, model, options) {

    var ogError = options.error,
        ogSuccess = options.success,
        tmp = ($.isFunction(model.url) ? model.url() : model.url);
        
    if (window.XDomainRequest) {
        model.url = tmp + '?token='+getCookie('_token');
    }
    
    options.error = function(model, xhr, options) {
    
        if (xhr.responseText=='logout') {
            window.location = '/member/loginform';
        }
        
        if ( typeof ogError === 'function' ) {
            ogError(model, xhr, options);
        }
        
    };
    
    return ogSync(method, model, options);
    
};

/**
****************************************************************************************
*************************************** MODELS *****************************************
****************************************************************************************
**/
ComContactRequest = Backbone.Model.extend({
    urlRoot: '/profile/bb-contact-request/data',
    idAttribute: 'pk',
    initialize: function() {
       //nothing to init
    }
});

ComContactPending = Backbone.Model.extend({
    idAttribute: 'pk',
    initialize: function() {
       //nothing to init
    }
});

ComContact = Backbone.Model.extend({
    urlRoot: '/profile/bb-contacts/data',
    idAttribute: 'pk',
    defaults: {
        name: '',
        phone: '',
        phone_ext: '',
        address_street1: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        website: '',
        email: '',
        referred: false
    },
    initialize: function() {
    
        this.on('change',function(d) {
            
            this.save(this.toJSON);
            
        });
        
        this.on('change:referred', function(d) {
        
            if ( this.get('referred') ) {
                $('.refer_btn').addClass('active');
            } else {
                $('.refer_btn.active').removeClass('active');
            }
            
        });
        
    },
    remove: function() {
    
        var cid = this.cid,
            p = pointer['com_contacts_view'].hideItem(cid);
        
        this.destroy({
            wait: true,
            success: function(model,response) {
            
                p.removeItem(cid);
                
            },error:function(model,response){
            
                p.showItem(cid);
                
            }
        });
        
    },
    getFormattedPhone: function() {
    
        return formatPhone(this.get('phone'));
        
    },
    getFormattedAddress: function() {
    
        var t = this;
        
        return formatAddress(
            t.get('address_street1'), 
            t.get('address_city'), 
            t.get('address_state'), 
            t.get('address_zip') 
        );
        
    },
    isReferred: function() {
    
        return this.get('referred') ? 'active' : '';
        
    },
    checkAccess: function(callback) {
        
        if (is_gift) {
            var url = ['/shop/check-access/resource/news/receiver_pk/'];
            url.push(this.get('pk'));
            url.push('/item_id/');
            url.push(share_item_id);
            $.get(url.join(''))
                .success(function(access){
                    callback(access);
                });
        } else {
            callback(true);
        }
        
    }
});

ComGroup = Backbone.Model.extend({
    urlRoot: '/profile/bb-groups/data',
    idAttribute: 'group_pk',
    defaults: {
        admin: false,
        name: '',
        phone: '',
        phone_ext: '',
        address_street1: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        website: '',
        email: '',
        members: '',
        price_group: ''
    },
    initialize: function() {
    
        var t = this;
        
        if ( t.get('admin') ) {
            t.set('group_label','Groups I\'ve Created');
            t.set('order','0');
        } else {
            t.set('group_label','Groups I\'ve Joined');
            t.set('order','1');
        }
        
    },
    getFormattedPhone: function() {
    
        return formatPhone(this.get('phone'));
        
    },
    getFormattedAddress: function() {
    
        var t = this;
        
        return formatAddress(
            t.get('address_street1'), 
            t.get('address_city'), 
            t.get('address_state'), 
            t.get('address_zip') 
        );
        
    },
    remove: function() {
        
        if ( this.get('admin') ) {
            var confirm_string = [];
            confirm_string.push('Are you sure you want to delete ');
            confirm_string.push(this.get('name'));
            confirm_string.push('? \r\rWarning: You will be deleting this group for all the members of it.');
            if ( !confirm(confirm_string.join('')) ) {
                return;
            }
        }
        
        var cid = this.cid;
        pointer['com_groups_view'].hideItem(cid);
        
        this.destroy({
            wait: true,
            success: function (model,response) {
            
                pointer['com_groups_view'].removeItem(cid);
                
            },
            error: function (model,response) {
            
                pointer['com_groups_view'].showItem(cid);
                
            }
        });
        
    }
});

ComMessage = Backbone.Model.extend({
    urlRoot: '/profile/bb-message/data',
    idAttribute: 'pk',
    defaults: {
        sent: 0,
        body: '',
        messages_body_pk: 0,
        sent_datetime: '',
        viewed_datetime: '',
        sent_datetime_display: 'sending...',
        viewed_datetime_display: ''
    },
    initialize: function() {
        
        var t = this,
            mdl;
        
        if ( mdl = this.get('contactModel') ) {
            t.set({
                recipient_pk: mdl.get('pk'),
                recipient_name: mdl.get('name')
            },{silent:true});
            t.unset('contactModel');
        }
        
        if ( t.get('sent_datetime') != '' && t.get('sent_datetime') != null) {
            t.setSentDisplay();
        }
        if ( t.get('viewed_datetime') != '' && t.get('viewed_datetime') != null ) {
            t.setViewedDisplay();
        }
        if ( t.get('body') != '' ) {
            t.formatBody();
        }
        
        t.on('change:viewed_datetime',function() {
        
            if ( t.get('viewed_datetime') != '' && t.get('viewed_datetime') != null ) {
                com_conversations.checkforunread();
                t.setViewedDisplay();
            }
            
        });
        t.on('change:sent_datetime',function() {
            
            var d = t.setSentDisplay();
            pointer['com_conversations_view'].updateList();
            
            if ( $('[data-cid="'+t.cid+'"]').exists() ) {
                $('[data-cid="'+t.cid+'"]')
                    .find('.com_pop_conversations_message_li_sent_date')
                        .html(d)
                    .end()
                    .find('.com_pop_message_li_viewed_date')
                        .html(t.get('viewed_datetime_display'));
            }
            
        });
        t.unset('auth_pk');
        
    },
    markViewed: function(m) {
    
        var t = this;
        
        t.save(this.attributes,{
            success: function() {
            
                $('[data-cid="'+m.cid+'"]').removeClass('new');
                
                if ( t.get('sent') == 1 ) {
                    $('[data-cid="'+m.cid+'"] .com_pop_message_li_viewed_date')
                        .html(m.get('viewed_datetime_display'))
                        .removeClass('hidden');
                }
                
                com_conversations.checkforunread();
                
            }
        });
        
    },
    formatDate: function(x,full) {
    
        var monthNames = ["January","February","March","April","May","June","July",
        					"August","September","October","November","December"],
            monthNamesAbbr = ["Jan","Feb","Mar","Apr","May","Jun",
            					"Jul","Aug","Sep","Oct","Nov","Dec"],
            today = new Date(),
            date = parseDate(x),
            displayDate;
        var year = date.getFullYear(),
            month = monthNames[date.getMonth()],
            day = date.getDate(),
            hour = date.getHours(),
            min = date.getMinutes();
        var timeFormatted = [
        		(hour > 12 ? hour - 12 : hour),':',
        		(( min < 10 ? '0' : '' ) + min),' ',
        		(hour > 11 ? 'PM' : 'AM')].join('');
        var datetimeFormatted = [month,' ',day,', ',year,' ',timeFormatted].join('');
        
        if (today.getFullYear() != year) {
            displayDate = [
            	date.getMonth(),'/',
            	day,'/',
            	String(year).substring(2)].join('');
        } else if ( today.getMonth() != date.getMonth() || today.getDate() != day ) {
            displayDate = [monthNamesAbbr[date.getMonth()],' ',day].join('');
        } else {
            displayDate = timeFormatted;
        }
        
        if (!full) {
            return _.template($('#abbr_template').html(),{ 
                title: datetimeFormatted,
                display: displayDate
            });
        } else {
            return datetimeFormatted;
        }
        
    },
    formatBody: function() {
    
        var body = this.get('body');//decodeURI(this.get('body')),
        
        body = body.replace("'", "&rsquo;"); //encodes single quotes
        body = body.replace(/<[^>]+>/gi, ""); //removes html mark up
        body = body.replace(/\[\[br\]\]/gi, "<br />"); //codes line breaks
        
        body = body.replace(/https?\:\/\/\S+\.\S+/gi, function(s) { //codes links
        
            return '<a href="'+s+'" target="_blank">'+s+'</a>';
            
        });
        
        this.set('body_display', body);
        
    },
    setViewedDisplay: function() {
        
        this.set('viewed_datetime_display', _.template( $('#viewed_date_display').html(),{
            date: this.formatDate(this.get('viewed_datetime'),true)
        }));
        
        if ( $('[data-cid="'+this.cid+'"]').exists() ) {
            $('[data-cid="'+this.cid+'"]').find('.com_pop_message_li_viewed_date')
                .html( this.get('viewed_datetime_display') );
        }
        
    },
    setSentDisplay: function() {
        
        var d = this.formatDate(this.get('sent_datetime'),false);
        
        this.set('sent_datetime_display',d);
        this.set('viewed_datetime_display','Delivered');
        
        return d;
        
    },
    remove: function() {
    
        var cid = this.cid;
        
        pointer['viewMessages'].hideItem(cid);
        this.destroy({
            wait:true,
            success: function(model,response) {
                pointer['viewMessages'].removeItem(cid);
            },error: function(model,response) {
                pointer['viewMessages'].showItem(cid);
            }
        });
        
    }
});

ComConversation = Backbone.Model.extend({
    urlRoot: '/profile/bb-conversation/data',
    idAttribute: 'recipient_pk',
    defaults: {
        recipient_pk: null,
        group_pk: null,
        recipient_name: null,
        messagesCollection: null
    },
    initialize: function() {
        var t = this,
            group_pk,
            group;
        var col = t.get('messagesCollection') || null;
        
        if (!col) {
            t.set({
                messagesCollection: new ComMessages()
            });
            col = t.get('messagesCollection');
        }
        
        if ( t.get('body') ) {
            col.add({
                pk: t.get('pk'),
                recipient_pk: t.get('recipient_pk'),
                recipient_name: t.get('recipient_name'),
                messages_body_pk: t.get('messages_body_pk'),
                sent: t.get('sent'),
                type: t.get('type'),
                body: t.get('body'),
                sent_datetime: t.get('sent_datetime'),
                viewed_datetime: t.get('viewed_datetime')
            },{silent:true});
            t.unset('pk');
            t.unset('messages_body_pk');
            t.unset('sent');
            t.unset('body');
            t.unset('type');
            t.unset('sent_datetime');
            t.unset('viewed_datetime');
            
            if ( group_pk = t.get('group_pk') ) {
                group = com_groups.get(group_pk);
                if (group) {
                    if (group.get('group_type') === 'chat') {
                    
                    } else {
                        t.set('recipient_pk','g'+t.get('group_pk'));
                    }
                }
            }
        }
        
    },
    getConvo: function(options) {
    
        var t   = this;
        var col = t.get('messagesCollection');
        
        col.getMessages(t.get('recipient_pk'),options);
        
    },
    markViewed: function(m) {
    
        var t = this;
        
        //t.save(t.attributes,{
        //  success: function() {
            
                $('[data-cid="'+m.cid+'"]').removeClass('new');
                
                if (t.get('sent') == 1) {
                    $('[data-cid="'+m.cid+'"] .com_pop_message_li_viewed_date')
                        .html(m.get('viewed_datetime_display'))
                        .removeClass('hidden');
                }
                
        //  }
        //});
        
    },
    remove: function() {
    
        var cid = this.cid;
        
        pointer['com_conversations_view'].hideItem(cid);
        this.destroy({
            wait: true,
            success: function(model,response) {
            
                pointer['com_conversations_view'].removeItem(cid);
                
            },error: function(model,response) {
            
                pointer['com_conversations_view'].showItem(cid);
                
            }
        });
        
    },
    sortByViewed: function() {
    
        return this.get('messagesCollection').sortBy(function(message) {
        
            if (message.get('viewed_datetime') == '') {
                var date = new Date('0');
            } else {
                var date = new Date(parseDate(message.get('viewed_datetime')));
            }
            
            return -date;
            
        });
        
    }
});
    


/**
****************************************************************************************
************************************ COLLECTIONS ***************************************
****************************************************************************************
**/
ComContactRequests = Backbone.Collection.extend({
    model: ComContactRequest,
    comparator: function(contact) {
    
        return contact.get('name');
        
    },
    group: function() {
    
        return this.groupBy(function(model) {
        
            return String(model.get('name')).charAt(0);
            
        });
        
    }
});

ComContactPendings = Backbone.Collection.extend({
    model: ComContactPending,
    comparator: function(contact) {
    
        return contact.get('name');
        
    },
    group: function() {
    
        return this.groupBy(function(model) {
        
            return String(model.get('name')).charAt(0);
            
        });
        
    }
});

ComContacts = Backbone.Collection.extend({
    model: ComContact,
    comparator: function(contact) {
    
        return contact.get('name');
        
    },
    group: function() {
    
        return this.groupBy(function(model) {
        
            return String(model.get('name')).charAt(0);
            
        });
        
    }
});

ComGroups = Backbone.Collection.extend({
    model: ComGroup,
    comparator: function(group) {
    
        return [
            group.get('order'), 
            String(group.get('name')).toLowerCase()
        ];
        
    },
    group: function() {
    
        return this.groupBy(function(model) {
        
            return String(model.get('group_label'));
            
        });
        
    }
});

ComMessages = Backbone.Collection.extend({
    url: '/profile/bb-messages/data/',
    model: ComMessage,
    comparator: function(message) {
    
        return new Date(parseDate(message.get('sent_datetime')));
        
    },
    group: function() {
    
        return this.groupBy(function(model) {
        
            return String(model.get('recipient_pk'));
            
        });
        
    },
    checkforunread: function() {
    
        var t = this,
            unread = false;
            
        $.each(this.models, function(k,v) {
        
            if ( (v.get('viewed_datetime') == '' || 
                  v.get('viewed_datetime' ) == null) &&
                  v.get('sent') == 0 ) {
                unread = true;
            }
            
        });
        
        return unread;
        
    },
    getMessages: function(recipient_pk,options) {
    
        var ogurl = this.url;
        
        this.url += recipient_pk;
        this.fetch(options);
        this.url = ogurl;
        
    }
});

ComConversations = Backbone.Collection.extend({
    url: '/profile/bb-conversations/data/',
    model: ComConversation,
    comparator: function(conversation) {
    
        var col = conversation.get('messagesCollection');
        var lastMessage = col.at(0);
        
        if ( lastMessage ) {
            var date = new Date(parseDate(lastMessage.get('sent_datetime')));
        } else {
            var date = new Date();
        }
        
        return -date;
        
    },
    checkforunread: function() {
    
        var unread = false,
            col;
        
        $.each(this.models, function(k,v) {
        
            col = v.get('messagesCollection');
            
            if ( col.checkforunread() ) {
                unread = true;
            }
            
        });
        
        if (unread) {
            $('.com_bar .com_messages span').addClass('notify');
        } else {
            $('.com_bar .com_messages span').removeClass('notify');
        }
        
    },
    getLastDate: function() {
    
        var random_past_date = encodeURI('1969-12-31 13:37:00');
    
        if (this.length > 0) {
            var last = this.at(0).get('messagesCollection').length-1;
            
            if ( this.at(0).get('messagesCollection').at(last) ) {
                var lastSentDate = this.at(0)
                                       .get('messagesCollection')
                                       .at(last)
                                           .get('sent_datetime'),
                    colSorted = this.sortBy(function(conversation) {
                
                        var msgSorted = conversation.sortByViewed();
                        var viewed = msgSorted[0].get('viewed_datetime');
                        
                        if (viewed == '') {
                            var date = new Date('0');
                        } else {
                            var date = new Date(parseDate(viewed));
                        }
                        
                        return -date;
                        
                    });
                
                var msgSorted = colSorted[0].sortByViewed();
                var lastViewedDate = msgSorted[0].get('viewed_datetime');
                if ( lastViewedDate > lastSentDate ) {
                    return encodeURI(lastViewedDate);
                } else {
                    return encodeURI(lastSentDate);
                }
            } else {
                return random_past_date;
            }
        } else {
            return random_past_date;
        }
        
    }
});


/**
****************************************************************************************
**************************************** VIEWS *****************************************
****************************************************************************************
**/
ComBarView = Backbone.View.extend({
    initialize: function() {
    
        this.render();
        
    },
    render: function() {
    
        com_auth ? this.loadMember() : this.loadGuest();
        
    },
    events: {
        'click .com_btn': 'showPop'
    },
    loadGuest: function() {
    
        var contentVars = { messages: '', share: '' };
        var content = _.template( $('#com_bar_content_template').html(), contentVars );
        var variables = { content: content };
        var template = _.template( $('#com_bar_template').html(), variables );
        
        this.$el.html( template );
        $('.com_bar [data-noyellow]').removeYellow();
        
        var logo_tooltip = new ComBarTooltip({
            el: $('#com_logo_tooltip'),
            copy: $('#tooltip_logo_template').html(),
            title: 'Community'
        });
        
    },
    loadMember: function() {
    	
        var pop_messages = this.loadMessages(),
            pop_share = this.loadShare();
        var contentVars = { messages: pop_messages, share: pop_share };
        var content = _.template( $('#com_bar_content_template').html(), contentVars );
        var variables = { content: content };
        var template = _.template( $('#com_bar_template').html(), variables );
        
        this.$el.html( template );
        this.loadTooltips();
        this.loadUserDropdown();
        
    },
    loadTooltips: function() {
    
        var logo_tooltip = new ComBarTooltip({
            el: $('#com_logo_tooltip'),
            copy: $('#tooltip_logo_template').html(),
            title: 'Community'
        });
        var profile_tooltip = new ComBarTooltip({
            el: $('#com_profile_tooltip'),
            copy: $('#tooltip_profile_template').html(),
            title: 'Profile'
        });
        var contacts_tooltip = new ComBarTooltip({
            el: $('#com_contacts_tooltip'),
            copy: $('#tooltip_contacts_template').html(),
            title: 'Contacts'
        });
        var groups_tooltip = new ComBarTooltip({
            el: $('#com_groups_tooltip'),
            copy: $('#tooltip_groups_template').html(),
            title: 'Groups'
        });
        var messages_tooltip = new ComBarTooltip({
            el: $('#com_messages_tooltip'),
            copy: $('#tooltip_messages_template').html(),
            title: 'Messages'
        });
        var sharing_tooltip = new ComBarTooltip({
            el: $('#com_sharing_tooltip'), 
            copy: $('#tooltip_sharing_template').html(),
            title: 'Sharing'
        });
        
    },
    loadUserDropdown: function() {
    
        $('.com_cp_btn_container').hover(function() {
        
            $(this).children('ul').slideDown(400,'easeOutExpo');
            
        },function() {
        
            $(this).children('ul').stop().slideUp(400,'easeInExpo');
            
        });
        
    },
    loadContacts: function() {
    
        return _.template( $('#com_bar_pop_template').html(), {
            head: 'Contacts',
            body: 'Content goes here'
        });
        
    },
    loadGroups: function() {
    
        return _.template( $('#com_bar_pop_template').html(), {
            head: 'Groups',
            body: 'Content goes here'
        });
        
    },
    loadMessages: function() {
    
        return _.template( $('#com_bar_pop_template').html(), {
            head: 'Messages',
            body: 'Content goes here'
        });
        
    },
    loadShare: function() {
    
        return _.template( $('#com_bar_pop_template').html(), {
            head: 'Share',
            body: 'Content goes here'
        });
        
    },
    showPop: function(e) {
    	
        var t = this,
            el = $(e.currentTarget).siblings('.com_box');
        var p_view = el.attr('id') + '_view';
        
        if ( el.children('.box').is(':hidden') ) {
            el.children('.box')
                .stop(true,true)
                .fadeIn(200,function() {
                
                    t.initHidePop( p_view, el );
                    
                })
            .end()
            .siblings('.com_tooltip_container')
                .stop(true,true)
                .animate({
                    'margin-left': '320px'
                },t.options.speed,t.options.easing)
                .children('.com_tooltip')
                    .children('.com_tooltip_arrow_top')
                        .removeClass('com_tooltip_arrow_top')
                        .addClass('com_tooltip_arrow_left');
        }
        
    },
    initHidePop: function(p_view,el) {
    
        var t = this;
        $('body').click(function(e) {
        
            if ( !$(e.target).parents('.com_box').exists() && 
                 !$(e.target).parents('.overall').exists() ) {
                 
                $('body').unbind('click');
                el.children('.box')
                    .stop(true,true)
                    .fadeOut(200,function() {
                    
                        pointer[p_view].goToPage(1);
                        
                    })
                .end()
                .siblings('.com_tooltip_container')
                    .stop(true,true)
                    .animate({
                        'margin-left':'0'
                    },t.options.speed,t.options.easing)
                    .children('.com_tooltip')
                        .children('.com_tooltip_arrow_left')
                            .removeClass('com_tooltip_arrow_left')
                            .addClass('com_tooltip_arrow_top');
            }
            
        });
        
    }
});

ComBarTooltip = Backbone.View.extend({
    initialize: function(){
        this.render();
    },
    render: function(){
        var variables = { tooltip: this.options.copy, title: this.options.title };
        var template = _.template( $('#com_bar_tooltip_template').html(), variables );
        this.$el.html( template );
        this.bindParent();
        this.$el.find('.com_tooltip_copy').appear(function(){
            $(this).jScroll($(this).attr('data-scroll'));
        });
    },
    events: {
        'click .hide_tooltips': 'hideTooltip'
    },
    bindParent: function() {
    
        if (getCookie("com_tooltips") != 'hide') {
            this.$el.parent().hover(function() {
            
                $(this).children('.com_tooltip_container').fadeIn(100);
                
            },function() {
            
                $(this).children('.com_tooltip_container:animated').stop(true,true).hide();
                $(this).children('.com_tooltip_container').fadeOut(100);
                
            });
        }
        
    },
    hideTooltip: function ( event ){
        setCookie("com_tooltips",'hide');
        $('.com_tooltip_container').fadeOut(100,function(){
            $('.com_tooltip_container').remove();
        });
    }
});

ComPopBodyOverlay = Backbone.View.extend({
    initialize: function() {
    
        this.render();
        
    },
    render: function() {
        
        var t = this;
        
        t.$el.append( _.template( $('#com_bar_pop_body_overlay').html(),{
            text: t.options.text
        }));
        
    },
    response: function(response,callback) {
        
        var t = this;
        
        t.$('.com_pop_overlay_text,.com_pop_overlay_loader').fadeOut(200);
        t.$('.com_pop_overlay_response').html(response).fadeIn(400)
        
        setTimeout(function(){
            callback();
        },800);
        
    },
    responseRemove: function(response,callback) {
        
        var t = this;
        
        t.$('.com_pop_overlay_text,.com_pop_overlay_loader').fadeOut(200);
        t.$('.com_pop_overlay_response').html(response).fadeIn(400)
        
        setTimeout(function(){
            t.remove(callback);
        },800);
        
    },
    remove: function(callback) {
    
    	var t = this;
        t.$('.com_bar_pop_body_overlay_container').fadeOut(300,function(){
            t.$el.remove();
            callback();
        });
        
    }
});

ComPopListView = Backbone.View.extend({
    initialize: function(){
        this.$el = $('#'+this.options.ns);
        this.render();
    },
    render: function(){
        var t = this;
        var listHead = _.template( $('#com_bar_pop_head_template').html(),{
            title: t.options.listName
        });
        var template = _.template( $('#com_bar_pop_template').html(),{ 
            head: listHead
        });
        t.$el.html(template);
        t.renderList();
        
        t.$('.com_pop_list').appear(function(){
            $(this).jScroll({
                'scrollbarWidth':8,
                'indicatorColor':'#236B8A',
                'scrollbarColor':'#CCC',
                'scrollbarPadding':0
            });
        });
    },
    renderList: function(){
    
        var t = this,
            list = [],
            requestList = [];
        var grouped = t.collection.group(),
            requests = t.options.requests || null,
            pendings = t.options.pendings || null;
        
        if (pendings) {
            if (pendings.models.length) {
                var len = pendings.models.length,
                    listDividers = [],
                    tmp = $('#com_bar_pop_list_pendings_item_template').html();
                    
                for (var x = 0; x < len; x++) {
                    var i = pendings.models[x];
                    
                    listDividers.push( _.template( tmp, {
                        pk: i.get('pk'),
                        cid: i.cid,
                        name: i.get('name')
                    }) );
                }
                
                if ( listDividers ) {
                    list.push( _.template( $('#com_bar_pop_list_requests_template').html(), {
                        list: listDividers.join(''),
                        header: 'Requests Pending',
                        dclass: 'pendings'
                    }) );
                }
            }
            pendings.on('add', function(i) {
            
                var newli = _.template( $('#com_bar_pop_list_pendings_item_template').html(), {
                            pk: i.get('pk'),
                            cid: i.cid,
                            name: i.get('name')
                        });
                        
                $(newli).hide().appendTo( t.$('.sub.pendings').find('ul') ).delay(1300).slideDown(300,'easeOutExpo');
                
                t.$('.com_pop_list').jScroll({
                    'scrollbarWidth':8,
                    'indicatorColor':'#236B8A',
                    'scrollbarColor':'#CCC',
                    'scrollbarPadding':0
                });
                
            });
        }
        
        if (requests) {
            if (requests.models.length) {
                t.$el.siblings('.com_btn').find('span').addClass('notify');
                var len = requests.models.length,
                    listDividers = [],
                    tmp = $('#com_bar_pop_list_requests_item_template').html();
                
                for (var x = 0; x < len; x++) {
                    var i = requests.models[x];
                
                    listDividers.push( _.template( tmp, {
                        pk: i.get('pk'),
                        cid: i.cid,
                        name: i.get('name')
                    }) );
                }
            
                if ( listDividers ) {
                    list.push( _.template( $('#com_bar_pop_list_requests_template').html(), {
                        list: listDividers.join(''),
                        header: 'Contact Requests',
                        dclass: 'requests'
                    }) );
                }
            }
            
            requests.on('remove', function() {
                if (!requests.models.length) {
                    t.$('.sub.requests').slideUp(200,'easeOutExpo');
                    t.$el.siblings('.com_btn').find('span').removeClass('notify');
                }
            });
        }
        
        for (var x in grouped) {
        
            var listDividers = [],
                s = grouped[x];
            var len = s.length;
            
            for (var i = 0; i < len; i++) {
            
                var sv = s[i];
                
                listDividers.push( _.template( $('#com_bar_pop_list_item_template').html(),{
                    cid: sv.cid,
                    name: sv.attributes.name
                }) );
                
            }
            
            list.push( _.template( $('#com_bar_pop_list_divider_template').html(),{ 
                divider: x,
                list: listDividers.join('')
            }) );
            
        }
        
        t.$el.find('.body .com_page_slider').html( 
            _.template( $('#com_bar_pop_list_template').html(),{
                list: list.join('')
            })
        );
        
    },
    events: {
        'click .sub.contacts [data-cid] > .li > a': 'loadItem',
        'keyup .search_container > input': 'filterList',
        'click .deleteTrigger': 'showDelete',
        'click .deleteContainer .back': 'hideDelete',
        'mouseup .deleteContainer .delete': 'deleteItem',
        'mouseup .com_pop_head_edit': 'toggleDeleteTriggers',
        'mouseup .requests .accept': 'acceptRequest',
        'mouseup .requests .ignore': 'ignoreRequest',
        'mouseup .requests .add': 'addContact',
        'mouseup .requests .hide': 'hideRequest'
    },
    loadItem: function(e) {
    
        e.preventDefault();
        
        var t = this,
            ct = $(e.currentTarget);
        var opt = t.options;
        var col = opt.collection,
            ns = opt.ns;
        var item = col.get( ct.parents('[data-cid]').attr('data-cid') ),
            loader = ct.parent().find('.loader').show();
        
        item.fetch({
            silent: true,
            success: function(d,r) {
            
                pointer[ns] = new pointer[ns+'ViewTwo']({
                    model: item,
                    el: t.$el
                });
                
                t.$el.find('.com_box_page.two img').load(function() {
                
                    t.goToPage(2);
                    loader.hide();
                    
                });
                
            }
        });
        
    },
    filterList: function(e) {
    
        var t = this,
            cs = String( $(e.currentTarget).val() ).toLowerCase(),
            cc,cd,ca,text,start,end,strFirst,strMid,strEnd;
            
        $.each( t.$('[data-content] li.sub,li.sub'), function(k,v) {
        
            $(v).find('.com_pop_list_divider').addClass('hidden');
            
            $.each( $(v).find('li a[href]'), function(sk,sv) {
            
                text = $(this).text();
                cc = String(text).toLowerCase();
                cd = $(this).parent().siblings('.com_pop_list_divider');
                
                if ( cc.indexOf(cs) != -1 ) {
                    start = cc.indexOf(cs);
                    end = start + cs.length;
                    strFirst = text.slice(0,start);
                    strMid = text.slice(start,end);
                    strEnd = text.slice(end,cc.length);
                    $(this).html(strFirst+'<b>'+strMid+'</b>'+strEnd);
                    $(this).parents('[data-cid]').removeClass('hidden');
                    $(v).find('.com_pop_list_divider').removeClass('hidden');
                } else {
                    $(this).html( text );
                    $(this).parents('[data-cid]').addClass('hidden');
                }
                
            });
            
        });
        
        if (cs) {
            t.$('[data-content] li.sub.requests,li.sub.requests').addClass('hidden');
        } else {
            t.$('[data-content] li.sub.requests,li.sub.requests').removeClass('hidden');
        }
        
    },
    toggleDeleteTriggers: function(e) {
        var btn = this.$el.find('.com_pop_head_edit');
        if ( btn.hasClass('active') ) {
            this.hideDeleteTriggers();
        } else {
            this.showDeleteTriggers();
        }
    },
    showDeleteTriggers: function() {
        var btn = this.$el.find('.com_pop_head_edit');
        //show
        btn.addClass('active');
        this.$el.find('.com_pop_list .deleteTrigger').animate({
            'margin-left':'-20px'
        },400,'easeOutExpo');
        this.$el.find('.com_pop_list .li .loader').animate({
            'margin-left':'-20px'
        },400,'easeOutExpo');
    },
    hideDeleteTriggers: function() {
        var btn = this.$el.find('.com_pop_head_edit');
        //hide
        btn.removeClass('active');
        this.$el.find('.com_pop_list [data-cid] .li').animate({
            'left': '0px'
        },400,'easeOutExpo');
        this.$el.find('.com_pop_list .deleteTrigger').animate({
            'margin-left':'20px'
        },400,'easeOutExpo');
        this.$el.find('.com_pop_list .li .loader').animate({
            'margin-left':'0px'
        },400,'easeOutExpo');
    },
    showDelete: function(e){
        this.hideAllDeletes($(e.currentTarget).parents('.com_pop_list'));
        $(e.currentTarget).parents('.li').stop().animate({
            'left':'100px'
        },400,'easeOutExpo');
    },
    hideDelete: function(e){
        $(e.currentTarget).parents('[data-cid]').find('.li').animate({
            'left':'0px'
        },400,'easeOutExpo');
    },
    hideAllDeletes: function(t){
        t.find('.li').stop().animate({
            'left':'0px'
        },400,'easeOutExpo');
    },
    deleteItem: function(e){
        var cid = $(e.currentTarget).parents('[data-cid]').attr('data-cid');
        this.collection.get( cid ).remove();
    },
    hideItem: function(cid){
        var item = this.$el.find('[data-cid='+cid+']');
        if ( !item.siblings('[data-cid]').exists() ) {
            item.parents('.sub').slideUp(400,'easeOutExpo',function(){
                item.hide();
            });
        } else {
            item.slideUp(400,'easeOutExpo');
        }
    },
    showItem: function(cid){
        var item = this.$el.find('[data-cid='+cid+']');
        if ( !item.siblings('[data-cid]').exists() ) {
            item.show().parents('.sub').slideDown(400,'easeOutExpo');
        } else {
            item.slideDown(400,'easeOutExpo');
        }
    },
    acceptRequest: function(e) {
        
        var t = this;
        var el = $(e.currentTarget).parents('[data-cid]');
        var m = com_contact_requests.get(
                    el.attr('data-cid')
                );
        var pk = m.get('pk');       
        $.post('/profile/accept-contact/pk/'+pk);
        el.find('.options.new').animate({
            'left': '320px'
        },300,'easeOutExpo',function(){
            if (!com_contacts.get(pk) && !com_contact_pendings.get(pk)) {
                el.find('.options.accepted').animate({
                    'left': '200px'
                },300,'easeOutExpo');
            } else {
                t.hideRequest(e);
            }
        });
        
    },
    ignoreRequest: function(e) {
    
        var m = com_contact_requests.get(
                    $(e.currentTarget).parents('[data-cid]').attr('data-cid')
                );
        $.post('/profile/remove-contact-request/pk/'+m.get('pk'));
        this.hideRequest(e);
        
        
    },
    addContact: function(e) {
    
        var t = this;
        var el = $(e.currentTarget).parents('[data-cid]');
        var m = com_contact_requests.get(
                    el.attr('data-cid')
                );
        var pk = m.get('pk');   
        $.post('/profile/add-book-with-contact/list_type/white/list_name/hw/visibility/private/contact_auth_pk/'+pk)
        
        el.find('.options.accepted').animate({
            'left': '320px'
        },300,'easeOutExpo',function(){
            el.find('.options.accepted').html('Requested!');
            el.find('.options.accepted').animate({
                'left': '200px'
            },300,'easeOutExpo').parents('[data-cid]')
                .delay(1000)
                .slideUp(300,'easeOutExpo',function() {
                    t.hideRequest(e);
                });
        });
        
        el.find('.options.accepted').html('Requested');
        this.options.pendings.add({
            pk: pk,
            name: m.get('name')
        });
        
    },
    hideRequest: function(e) {
    
        var p = $(e.currentTarget).parents('[data-cid]');
        var m = com_contact_requests.get( p.attr('data-cid') );
                
        p.slideUp(200,'easeOutExpo');
        com_contact_requests.remove(m);
        
    },
    removeItem: function(cid){
        var item = this.$el.find('[data-cid='+cid+']');
        if ( !item.siblings('[data-cid]').exists() ) {
            item.parents('.sub').remove();
        } else {
            item.remove();
        }
    },
    goToPage: function(x,t,f){
        var t = this;
        this.$el.find('.com_page_slider').animate({
            'margin-left':'-'+((x-1)*parseInt(t.$el.find('.com_box_page').outerWidth(true)))+'px'
        },400,'easeOutExpo',function(){
            t.hideDeleteTriggers();
        });
    }
});

ComPopConversationsView = Backbone.View.extend({
    initialize: function() {
    
        this.$el = $('#'+this.options.ns);
        this.render();
        
    },
    render: function() {
    
        var t = this;
        
        var msgHead = _.template( $('#com_bar_pop_head_conversations_template').html(),{
            title: t.options.listName
        });
        var listHead = _.template( $('#com_bar_pop_head_template').html(),{
            title: msgHead
        });
        var template = _.template( $('#com_bar_pop_template').html(),{ 
            head: listHead
        });
        
        t.$el.html(template).find('.body > div')
            .html( $('#com_bar_pop_conversations_template').html() );
            
        t.renderMessages();
        
        t.$el.find('.com_pop_messages').appear(function() {
        
            $(this).jScroll({
                'scrollbarWidth':8,
                'indicatorColor':'#236B8A',
                'scrollbarColor':'#CCC',
                'scrollbarPadding':0,
                'scrollbarOverlay':true
            });
            
        });
        
        this.collection.checkforunread();
        
    },
    renderMessages: function() {
    
        var t = this,
            list = [];
        
        $.each(t.collection.models, function(k,v) {
        
            var col = v.get('messagesCollection');
            var sv = col.models[0],
                notifynew = '',
                convo_note = '',
                img;
            
            if ( sv.get('sent') == 0 && 
                    ( sv.get('viewed_datetime') == null || 
                      sv.get('viewed_datetime') == '') ) {
                notifynew = 'new';
            }
            
            if ( v.get('group_pk') ) {
                img = ['/group/show-group-pic/group_pk/',v.get('group_pk'),'.jpg'].join('');
            } else {
                img = ['/visibleuser/get-portrait/pk/',v.get('recipient_pk'),'.jpg'].join('');
            }
            
            if ( v.get('special_group_sender_pk') ) {
                convo_note = 'SUPPORT';
            }
            
            list.push( _.template( $('#com_bar_pop_conversations_li_template').html(),{ 
                cid: v.cid,
                recipient_img: img,
                recipient_pk: v.get('recipient_pk'),
                recipient_name: v.get('recipient_name'),
                message_body: String(sv.get('body_display')).replace(/<[^>]+>/gi, " "),
                sent: sv.get('sent'),
                note: convo_note,
                sent_date: sv.get('sent_datetime_display'),
                notifynew: notifynew
            }) );
            
        });
        
        t.$el.find('.body > div #com_pop_convo_list').html( list.join('') );
        
    },
    updateList: function() {
        var t = this;
        
        $.each(t.collection.models, function(k,v) {
            
            var col = v.get('messagesCollection');
            var last = col.length - 1;
            var sv = col.models[last],
                notifynew = '',
                convo_note = '';
            
            if ( $('[data-cid="'+v.cid+'"]').exists() ) {
                // update existing
                var el = $('[data-cid="'+v.cid+'"]');
                
                el.find('.com_pop_conversation_message_body')
                    .html( String(sv.get('body_display')).replace(/<[^>]+>/gi, "") )
                .end()
                .find('.com_pop_message_li_date')
                    .html( sv.get('sent_datetime_display') );
                    
                if ( sv.get('sent') == 0 ) {
                    el.find('.com_pop_conversation_sent_1')
                        .removeClass('com_pop_conversation_sent_1')
                        .addClass('com_pop_conversation_sent_0');
                        
                    if ( sv.get('viewed_datetime') == null || 
                         sv.get('viewed_datetime') == '' ) {
                        el.addClass('new');
                    } else {
                        el.removeClass('new');
                    }
                } else {
                    el.removeClass('new').find('.com_pop_conversation_sent_0')
                        .removeClass('com_pop_conversation_sent_0')
                        .addClass('com_pop_conversation_sent_1');
                }
            } else {
                // add new
                var img;
                
                if ( sv.get('sent') == 0 && 
                        (sv.get('viewed_datetime') == null || 
                         sv.get('viewed_datetime') == '') ) {
                    notifynew = 'new';
                }
                if ( v.get('group_pk') ) {
                    img = ['/group/show-group-pic/group_pk/',v.get('group_pk'),'.jpg'].join('');
                } else {
                    img = ['/visibleuser/get-portrait/pk/',v.get('recipient_pk'),'.jpg'].join('');
                }
                
                if ( v.get('special_group_sender_pk') ) {
                    convo_note = 'SUPPORT';
                }
                
                var msg = _.template( $('#com_bar_pop_conversations_li_template').html(),{ 
                    cid: v.cid,
                    recipient_img: img,
                    recipient_pk: v.get('recipient_pk'),
                    recipient_name: v.get('recipient_name'),
                    message_body: String(sv.get('body_display')).replace(/<[^>]+>/gi, " "),
                    sent: sv.get('sent'),
                    note: convo_note,
                    sent_date: sv.get('sent_datetime_display'),
                    notifynew: notifynew
                });
                
                t.$el.find('.body > div #com_pop_convo_list li').parent().prepend( msg );
            }
            
        });
        
        
        // sort the list by date
        if ( this.$el.find('ul#com_pop_convo_list [data-content]').exists() ) {
            var list = this.$el.find('ul#com_pop_convo_list [data-content]');
        } else {
            var list = this.$el.find('ul#com_pop_convo_list li').parent();
        }
        var listItems = list.children('li');
        
        listItems.sort(function(a,b) {
        
            var compA = t.collection.get( $(a).find('[data-cid]').attr('data-cid') );
            compA = compA.get('messagesCollection');
            compA = compA.models[compA.length-1];
            compA = new Date(parseDate(compA.get('sent_datetime')));
            
            var compB = t.collection.get( $(b).find('[data-cid]').attr('data-cid') );
            compB = compB.get('messagesCollection');
            compB = compB.models[compB.length-1];
            compB = new Date(parseDate(compB.get('sent_datetime')));
            
            return (compA < compB) ? 1 : (compA > compB) ? -1 : 0;
            
        });
        
        $(list).html(listItems);
        
    },
    events: {
        'click .one .com_pop_head_new_msg': 'newMsg',
        'click .one .com_pop_message_li': 'viewMessages',
        'mouseup .one .com_pop_head_edit': 'toggleDeleteTriggers',
        'click .one .deleteTrigger': 'showDelete',
        'click .one .deleteContainer .back': 'hideDelete',
        'click .one .deleteContainer .delete': 'deleteItem'
    },
    newMsg: function() {
    
        var t = this;
        
        pointer['NewMsg'] = new pointer[t.options.ns+'ViewTwoNewMsg']({
            el: t.$el
        });
        
        t.goToPage(2);
        
    },
    viewMessages: function(e) {
    
        var t       = this,
            ct      = $(e.currentTarget);
            
        var msg     = ct.find('.com_pop_message_li_msg'),
            loader  = ct.siblings('.loader'),
            cid     = ct.attr('data-cid');
            
        var mdl     = t.collection.get(cid);
            
        msg.data( 'width', msg.css('width') )
            .css({
                'width': '225px'
            });
        
        loader.show();
        
        mdl.getConvo({
            update: true,
            remove: false,
            silent: true,
            success: function() {
                
                pointer['viewMessages'] = new ComPopMessagesView({
                    el: t.$el,
                    model: mdl
                });
                
                t.goToPage(2,null,function() {
                
                    $('.body .com_box_page.two .newMsg_message').focus();
                    
                });
                
                msg.css({
                    'width': msg.data('width')
                });
                
                loader.fadeOut(200);
                ct.removeClass('new');
                com_conversations.checkforunread();
                
            }
        });
        
    },
    toggleDeleteTriggers: function(e) {
    
        var t = this;
        var btn = t.$el.find('.one .com_pop_head_edit');
        
        if ( btn.hasClass('active') ) {
            this.hideDeleteTriggers();
        } else {
            this.showDeleteTriggers();
        }
        
    },
    showDeleteTriggers: function() {
    
        var t = this;
        
        t.$el.find('.one')
            .find('.com_pop_head_edit')
                .addClass('active')
            .end()
            .find('.com_pop_messages .deleteTrigger')
                .animate({
                    'margin-left': '-25px'
                },400,'easeOutExpo');
        
    },
    hideDeleteTriggers: function() {
    
        var t = this;
        
        t.$el.find('.one')
            .find('.com_pop_head_edit')
                .removeClass('active')
            .end()
            .find('.com_pop_messages')
                .find('.li')
                    .stop(true,true)
                    .animate({
                        'left': '0px'
                    },400,'easeOutExpo')
                .end()
                .find('.deleteTrigger')
                    .stop(true,true)
                    .animate({
                        'margin-left': '20px'
                    },400,'easeOutExpo');
        
    },
    showDelete: function(e) {
    
        var ct = $(e.currentTarget);
        
        this.hideAllDeletes( ct.parents('.com_pop_messages') );
        ct.parents('.li').stop(true,true).animate({
            'left': '100px'
        },400,'easeOutExpo');
        
    },
    hideDelete: function(e) {
    
        $(e.currentTarget).parents('.deleteContainer')
            .siblings('.li')
                .stop(true,true)
                .animate({
                    'left':'0px'
                },400,'easeOutExpo');
        
    },
    deleteItem: function(e) {
        
        var t = this;
        var p = $(e.currentTarget).parents('.deleteContainer').parent();
        var mdl = t.collection.get( p.find('[data-cid]').attr('data-cid') );
        
        mdl.destroy();
        
        p.slideUp(300,'easeOutExpo',function() {
            
            this.remove();
            t.$('.com_box_page.one .com_pop_messages').jScroll();
            
        });
        
    },
    hideAllDeletes: function(t) {
    
        t.find('.li')
            .stop(true,true)
            .animate({
                'left': '0px'
            },400,'easeOutExpo');
        
    },
    goToPage: function(x,v,f){
    
        var t = this;
        var width = (x-1) * parseInt( t.$el.find('.com_box_page').outerWidth(true) )
        
        return t.$el.find('.com_page_slider')
            .stop(true,true)
            .animate({
                'margin-left': '-' + width + 'px'
            }, 400, 'easeOutExpo', function() {
            
                if ( $('.com_page_slider:animated').length === 0 ) {
                    t.hideDeleteTriggers();
                    if ( x == 1 ) {
                        if ( pointer['viewMessages'] ) {
                            pointer['viewMessages'].undelegateEvents();
                            pointer['viewMessages'].remove();
                            pointer['viewMessages'] = null;
                        }
                        if ( pointer['newMsg'] ) {
                            pointer['newMsg'].undelegateEvents();
                            pointer['newMsg'].remove();
                            pointer['newMsg'] = null;
                        }
                        if ( pointer['SocPreChatForm'] ) {
                            pointer['SocPreChatForm'].undelegateEvents();
                            pointer['SocPreChatForm'].remove();
                            pointer['SocPreChatForm'] = null;
                        }
                    } else if ( x == 2 && typeof f === 'function' ) {
                        f();
                    }
                }
            
            });
        
    }
});

ComPopMessagesView = Backbone.View.extend({
    initialize: function() {
    
        var t = this;
        
        t.render();
        t.model.get('messagesCollection').on('response',t.updateList,t);
        
    },
    render: function() {
        
        var t = this;
        var m = t.model;
        var col = m.get('messagesCollection'),
            template = $('#com_bar_pop_conversations_messages_li_template').html(),
            viewedClass = 'hidden',
            list = [],
            name,
            pk;
        
        $.each(col.models, function(k,v) {
        
            if ( parseInt(v.get('sent')) == 0 ) {
                name = v.get('recipient_name');
                pk = String(v.get('recipient_pk'));
                if (pk.indexOf('cg') > -1) {
                    var data = pk.substring(pk.indexOf('cg'));
                    data = data.split('-');
                    pk = data[0];
                }
            } else {
                name = com_auth_name;
                pk = com_auth_pk;
                if ( k == (col.length-1) ) {
                    viewedClass = '';
                }
            }
            
            list.push( _.template( template, {
                cid: v.cid,
                recipient_pk: pk,
                recipient_name: name,
                message_body: v.get('body_display'),
                sent_date: v.get('sent_datetime_display'),
                viewed_date: v.get('viewed_datetime_display'),
                viewed_class: viewedClass
            }) );
            
        });
        var body = _.template( $('#com_bar_pop_messages_template').html(), {
            messages: list.join('')
        });
        var head = _.template( $('#com_bar_pop_head_2_messages_template').html(), {
            title   : m.get('recipient_name'),
            back    : 'Messages'
        });
        
        t.$el.find('.head .com_box_page.two')
            .html(head)
        .end()
        .find('.body .com_box_page.two')
            .html(body)
            .find('.com_pop_messages').appear(function() {
            
                $(this).jScroll({
                    'scrollbarWidth': 8,
                    'indicatorColor': '#236B8A',
                    'scrollbarColor': '#CCC',
                    'scrollbarPadding': 0,
                    'scrollbarOverlay': true,
                    'scrollbarMargin': 3,
                    'showBottom': true
                });
                
            });
        
    },
    events: {
        'click .head .com_box_page.two .com_pop_header_btn_back': 'goBack',
        'click .body .newMsg_send.btn': 'sendMessage',
        'keydown .body .newMsg_message': 'checkEnter',
        'mouseup .two .com_pop_head_edit': 'toggleDeleteTriggers',
        'click .two .deleteTrigger': 'showDelete',
        'click .two .deleteContainer .back': 'hideDelete',
        'click .two .deleteContainer .delete': 'deleteItem'
    },
    updateList: function() {
        
        var t = this;
        
        var m = t.model;
        var col = m.get('messagesCollection'),
            viewedClass='hidden',
            newMsg,
            name,
            pk;
        
        $.each(col.models, function(k,v) {
            
            if ( $('[data-cid="'+v.cid+'"]').exists() ) {
            
                var el = $('[data-cid="'+v.cid+'"]')
                    .find('.com_pop_conversations_message_li_sent_date')
                        .html( v.get('sent_datetime_display') )
                    .end()
                    .find('.com_pop_message_li_viewed_date ')
                        .html( v.get('viewed_datetime_display') )
                    .end();
                    
                if ( k != (col.length-1)) {
                    el.find('.com_pop_message_li_viewed_date').hide();
                }
                
            } else {
            
                if ( parseInt(v.get('sent')) == 0 ) {
                    name = v.get('recipient_name');
                    pk = v.get('recipient_pk');
                    if ( v.get('viewed_datetime') == '' || v.get('viewed_datetime') == null ) {
                        v.markViewed(v);
                    }
                } else {
                    name = com_auth_name;
                    pk = com_auth_pk;
                    if ( k == (col.length-1) ) {
                        viewedClass = '';
                    }
                }
                
                newMsg = _.template( $('#com_bar_pop_conversations_messages_li_template').html(), {
                    cid: v.cid,
                    recipient_pk: pk,
                    recipient_name: name,
                    message_body: v.get('body_display'),
                    sent_date: v.get('sent_datetime_display'),
                    viewed_date: v.get('viewed_datetime_display'),
                    notifynew: '',
                    li_class: '',
                    viewed_class: viewedClass
                });
                
                if ( $('#com_pop_messages_list').find('li').last().exists() ) {
                    $('#com_pop_messages_list').find('li').last().after(newMsg);
                } else {
                    $('#com_pop_messages_list').find('[data-content]').html(newMsg);
                }
                
            }
            
        });
        
        t.$el.find('.com_box_page.two .com_pop_messages').jScroll();
        
    },
    sendMessage: function() {
        
        var t = this;
        var m = t.model;
    
        if ( t.$el.find('.newMsg_message').val() != '' ) {
        
            var col = m.get('messagesCollection');
            var rpk = m.get('recipient_pk');
            var msg = '';
            
            if (String(rpk).indexOf('cg') > -1) {
                msg = getCookie('live_chat_prepend') || '';
            }
            
            msg += t.$el.find('.newMsg_message').val();
            
            col.create({
                sent: 1,
                group_pk: m.get('group_pk') || null,
                body: msg,
                recipient_pk: m.get('recipient_pk'),
                recipient_name: m.get('recipient_name')
            });
            
            this.$el.find('.newMsg_message').val('');
            t.updateList();
            
        }
        
    },
    checkEnter: function(e) {
    
        if ( e.keyCode == '13' ) {
            e.preventDefault();
            this.sendMessage();
        }
        
    },
    toggleDeleteTriggers: function(e) {
    
        var btn = this.$el.find('.two .com_pop_head_edit');
        
        if ( btn.hasClass('active') ) {
            this.hideDeleteTriggers();
        } else {
            this.showDeleteTriggers();
        }
        
    },
    showDeleteTriggers: function() {
    
        this.$el.find('.two .com_pop_head_edit')
            .addClass('active')
        .end()
        .find('.two .com_pop_messages .deleteTrigger')
            .stop(true,true)
            .animate({
                'margin-left':'-=50'
            },400,'easeOutExpo')
        .end()
        .find('.two .com_pop_messages .com_pop_conversations_message_li_sent_date')
            .stop(true,true)
            .animate({
                'left':'-=20'
            },400,'easeOutExpo');
        
    },
    hideDeleteTriggers: function() {
    
        this.$el.find('.two')
            .find('.com_pop_head_edit')
                .removeClass('active')
            .end()
            .find('.com_pop_messages')
                .find('.li')
                    .stop(true,true)
                    .animate({
                        'left': '0px'
                    },400,'easeOutExpo')
                .end()
                .find('.deleteTrigger')
                    .stop(true,true)
                    .animate({
                        'margin-left':'+=50'
                    },400,'easeOutExpo')
                .end()
                .find('.com_pop_conversations_message_li_sent_date')
                    .stop(true,true)
                    .animate({
                        'left':'+=20'
                    },200,'easeOutExpo');
        
    },
    showDelete: function(e) {
        
        var ct = $(e.currentTarget);
        
        this.hideAllDeletes( ct.parents('.com_pop_messages') );
        
        ct.parents('.li')
            .stop(true,true)
            .animate({
                'left':'100px'
            },400,'easeOutExpo');
        
    },
    hideDelete: function(e) {
    
        $(e.currentTarget).parents('.deleteContainer')
            .siblings('.li')
                .stop(true,true)
                .animate({
                    'left':'0px'
                },400,'easeOutExpo');
        
    },
    deleteItem: function(e) {
    
        var t = this;
        var p = $(e.currentTarget).parents('.deleteContainer').parent();
        var mdl = t.model.get('messagesCollection').get( p.find('[data-cid]').attr('data-cid') );
        
        mdl.destroy();
        
        p.slideUp(300,'easeOutExpo',function() {
            
            this.remove();
            
            p.siblings('li:visible')
                .last()
                    .find('.com_pop_message_li_viewed_date')
                        .removeClass('hidden')
                
            t.$('.com_box_page.two .com_pop_messages').jScroll();
            
        });
        
    },
    hideAllDeletes: function(t) {
    
        t.find('.li')
            .stop(true,true)
            .animate({
                'left':'0px'
            },400,'easeOutExpo');
        
    },
    goBack: function() {
    
        var t = this;
        
        t.undelegateEvents();
        pointer['com_conversations_view'].goToPage(1,t);
        
        t.$el.find('.body .com_box_page.two > div')
            .fadeOut(400, function() {
            
                t.undelegateEvents();
                t.remove();
                
            });
        
    },
    remove: function() {
        
        var t = this;
        
        t.model.get('messagesCollection').off('sync',t.updateList);
        
        t.$el.find('.body .com_box_page.two > div')
            .remove()
        .end()
        .find('.head .com_box_page.two > div')
            .remove();
            
        if ( pointer['newMsg'] ) {
            
            pointer['newMsg'].undelegateEvents();
            pointer['newMsg'].remove();
            pointer['newMsg'] = null;
        }
        
    }
});

ComPopShareView = Backbone.View.extend({
    initialize: function(){
        this.$el = $('#'+this.options.ns);
        this.render();
    },
    render: function(){
        var listHead = _.template( $('#com_bar_pop_head_template_basic').html(),{
            title: 'Share'
        });
        var template = _.template( $('#com_bar_pop_template').html(),{ 
            head: listHead
        });
        this.$el.html(template);
        this.$el.find('.body > div').html( $('#com_bar_pop_share_template').html() );
    },
    events: {
        'click #com_share_contacts': 'listContacts',
        'click #com_share_groups': 'listGroups'
    },
    listContacts: function() {
        
        var t = this;
        
        pointer['com_share_two'] = new pointer['com_shareList']({
            collection: com_contacts,
            el: t.$el
        });
        
        t.goToPage(2);
        
    },
    listGroups: function() {
        
        var t = this;
        
        pointer['com_share_two'] = new pointer['com_shareList']({
            collection: com_groups,
            el: t.$el
        });
        
        t.goToPage(2);
        
    },
    goToPage: function(x){
        var t = this;
        this.$el.find('.com_page_slider')
            .stop(true,true)
            .animate({
                'margin-left':'-'+((x-1)*parseInt(t.$el.find('.com_box_page').outerWidth(true)))+'px'
            },400,'easeOutExpo', function() {
                
                if ( $('.com_page_slider:animated').length === 0 &&
                     x == 1) {
                    if ( typeof pointer['com_share_three'] !== 'undefined' &&
                         pointer['com_share_three'] != null ) {
                        pointer['com_share_three'].undelegateEvents();
                        pointer['com_share_three'].remove();
                        pointer['com_share_three'] = null;
                    }
                    if ( typeof pointer['com_share_two'] !== 'undefined' &&
                         pointer['com_share_two'] != null ) {
                        pointer['com_share_two'].undelegateEvents();
                        pointer['com_share_two'].remove();
                        pointer['com_share_two'] = null;
                    }
                }
                
            });
    }
});

pointer['com_shareList'] = Backbone.View.extend({
    initialize: function() {
        this.render();
    },
    render: function() {
        // create list
        var list = [];
        var grouped = this.collection.group();
        $.each(grouped, function(k,v){
            var listDividers = [];
            $.each(v,function(sk,sv){
                listDividers.push( _.template( $('#com_bar_pop_list_item_template').html(),{
                    cid: sv.cid,
                    name: sv.attributes.name
                }) );
            });
            list.push( _.template( $('#com_bar_pop_list_divider_template').html(),{ 
                divider: k,
                list: listDividers.join('')
            }) );
        });
        var listBody = _.template( $('#com_bar_pop_list_stripped_template').html(),{
            list: list.join('')
        });
        
        var listHead = _.template( $('#com_bar_pop_head_2_template').html(),{
            title   : 'Contacts',
            back    : 'Share'
        });
        
        this.$el.find('.head .com_box_page.two').html(listHead);
        this.$el.find('.body .com_box_page.two').html(listBody);
    },
    events: {
        'click .head .com_box_page.two .com_pop_header_btn_back': 'goBack',
        'click [data-cid] > .li > a': 'loadItem',
        'keyup .search_container > input': 'filterList'
    },
    filterList: function(e) {
    
        var t = this,
            cs = String( $(e.currentTarget).val() ).toLowerCase(),
            cc,cd,ca,text,start,end,strFirst,strMid,strEnd;
            
        $.each( t.$el.find('[data-content] li.sub,li.sub'), function(k,v) {
        
            $(v).find('.com_pop_list_divider').addClass('hidden');
            
            $.each( $(v).find('li a[href]'), function(sk,sv) {
                
                text = $(this).text();
                cc = String(text).toLowerCase();
                cd = $(this).parent().siblings('.com_pop_list_divider');
                
                if ( cc.indexOf(cs) != -1 ) {
                    start = cc.indexOf(cs);
                    end = start + cs.length;
                    strFirst = text.slice(0,start);
                    strMid = text.slice(start,end);
                    strEnd = text.slice(end,cc.length);
                    $(this).html(strFirst+'<b>'+strMid+'</b>'+strEnd);
                    $(this).parents('[data-cid]').removeClass('hidden');
                    $(v).find('.com_pop_list_divider').removeClass('hidden');
                } else {
                    $(this).html( text );
                    $(this).parents('[data-cid]').addClass('hidden');
                }
                
            });
            
        });
        
    },
    loadItem: function(e) {
    
        e.preventDefault();
        var loader = $(e.currentTarget).parent().find('.loader').show();
        var t = this;
        var col = this.collection;
        var item = col.get( $(e.currentTarget).parents('[data-cid]').attr('data-cid') );
        var pk = item.get('pk') || 'g'+item.get('group_pk');
        var group_pk = item.get('group_pk') || null;
        var convo = com_conversations.get(pk);
        
        if ( !convo ) {
            com_conversations.add({
                recipient_pk: pk,
                recipient_name: item.get('name'),
                group_pk: group_pk,
                messagesCollection: null
            },{silent:true});
            
            convo = com_conversations.get(pk);
        }
        
        item.checkAccess(function(access) {
            
            var nextPage = 'com_share_messageViewThree';
            if (!access) nextPage += '_gift';
        
            pointer['com_share_three'] = new pointer[nextPage]({
                model: convo,
                el: t.$el
            });
                
            pointer['com_share_view'].goToPage(3);
            loader.hide();
            
        });

        
    },
    goBack: function(){
        var t = this;
        pointer['com_share_view'].goToPage(1,t);
        this.$el.find('.body .com_box_page.two > div').fadeOut(400,function(){
            t.undelegateEvents();
            t.remove();
        });
    },
    remove: function(){
        this.$el.find('.body .com_box_page.two > div').remove();
        this.$el.find('.head .com_box_page.two > div').remove();
    }
});

pointer['com_conversationsViewTwoNewMsg'] = Backbone.View.extend({
    initialize: function(){
        var t = this;
        this.render();
    },
    render: function(){
        
        var newMsgBody = _.template( $('#com_bar_pop_new_msg_template').html(),{
            autocomplete: this.renderAutoComplete()
        });
        var newMsgHead = _.template( $('#com_bar_pop_head_2_template').html(),{
            title   : 'New Message',
            back    : 'Messages'
        });
        this.$el.find('.head .com_box_page.two').html(newMsgHead);
        this.$el.find('.body .com_box_page.two').html(newMsgBody);
        
        this.$el.find('.newMsgAutoComplete').appear(function(){
            $(this).jScroll({
                'scrollbarWidth':8,
                'indicatorColor':'#236B8A',
                'scrollbarColor':'#CCC',
                'scrollbarPadding':0
            });
        });
    },
    renderAutoComplete: function(){
        // create list
        var list = '';
        var contacts = com_contacts.group();
        var groups = com_groups.group();
        $.each([contacts,groups], function(key, grouped){
            $.each(grouped, function(k,v){
                $.each(v,function(sk,sv){
                    list += _.template( $('#com_bar_pop_new_msg_autocomplete_li_template').html(),{
                        cid: sv.cid,
                        name: sv.attributes.name
                    });
                });
            });
        });
        return list;
    },
    events: {
        'click .head .com_box_page.two .com_pop_header_btn_back': 'goBack',
        'mouseup .body .newMsgAutoComplete ul > li > a': 'convoWith'
    },
    goBack: function(){
        var t = this;
        pointer['com_conversations_view'].goToPage(1,t);
        this.$el.find('.body .com_box_page.two > div').fadeOut(400,function(){
            t.undelegateEvents();
            t.remove();
        });
    },
    convoWith: function(e) {
    
        var t = this,
            cid = $(e.currentTarget).attr('data-cid');
        var item = com_contacts.get( cid ) || com_groups.get( cid );
        var pk = item.get('group_pk') ? 'g'+item.id : item.id,
            group_pk = item.get('group_pk') || null,
            mdl;
        
        mdl = com_conversations.where({
            recipient_pk: pk,
            group_pk: group_pk
        })[0];
        
        if ( !mdl ) {
            com_conversations.add({
                recipient_pk: pk,
                recipient_name: item.get('name'),
                group_pk: group_pk,
                messagesCollection: null
            },{silent:true});
            
            mdl = com_conversations.where({
                recipient_pk: pk,
                group_pk: group_pk
            })[0];
        }
        
        t.undelegateEvents();
        t.remove();
        
        pointer['viewMessages'] = new ComPopMessagesView({
            el: t.$el,
            model: mdl
        });
        
    },
    remove: function(){
        this.undelegateEvents();
        this.$el.find('.body .com_box_page.two > div').remove();
        this.$el.find('.head .com_box_page.two > div').remove();
        pointer['newMsg'] = null;
    }
});

pointer['com_contactsViewTwo'] = Backbone.View.extend({
    initialize: function(){
        var t = this;
        this.render();
    },
    render: function(){
        var contact = this.model;
        var contactPageTwo = _.template( $('#com_bar_contacts_info_template').html(),{
            pk      : contact.get('pk'),
            phone   : contact.getFormattedPhone(),
            address : contact.getFormattedAddress(),
            email   : contact.get('email'),
            website : contact.get('website'),
            refer   : contact.isReferred()
        });
        var contactPageTwoHead = _.template( $('#com_bar_pop_head_2_template').html(),{
            title   : contact.get('name'),
            back    : 'Contacts'
        });
        this.$el.find('.head .com_box_page.two').html(contactPageTwoHead);
        this.$el.find('.body .com_box_page.two').html(contactPageTwo);
        
        this.$el.find('.body .com_box_page.two .qmi').initQmi();
    },
    events: {
        'click .head .com_box_page.two .com_pop_header_btn_back': 'goBack',
        'mouseup .body .com_box_page.two .messaging_btn': 'message',
        'click .body .com_box_page.two .refer_btn': 'refer'
    },
    goBack: function(){
        var t = this;
        pointer['com_contacts_view'].goToPage(1,t);
        this.$el.find('.body .com_box_page.two > div').fadeOut(400,function(){
            t.undelegateEvents();
            t.remove();
        });
    },
    message: function() {
    
        $('body').click();
        $('.com_messages.com_btn').click();
        
        var t = this;
        var item = t.model;
        var pk = item.get('group_pk') ? 'g'+item.id : item.id,
            group_pk = item.get('group_pk') || null,
            mdl;
        
        mdl = com_conversations.where({
            recipient_pk: pk,
            group_pk: group_pk
        })[0];
        
        if ( !mdl ) {
            com_conversations.add({
                recipient_pk: pk,
                recipient_name: item.get('name'),
                group_pk: group_pk,
                messagesCollection: null
            },{silent:true});
            
            mdl = com_conversations.where({
                recipient_pk: pk,
                group_pk: group_pk
            })[0];
        }
        
        t.undelegateEvents();
        t.remove();
        
        pointer['viewMessages'] = new ComPopMessagesView({
            el: pointer['com_conversations_view'].$el,
            model: mdl
        });
        
        pointer['com_conversations_view'].goToPage(2);
        
    },
    refer: function(e){
        if ( this.model.get('referred') ) {
            this.model.set({referred: false});
        } else {
            this.model.set({referred: true});
        }
    },
    remove: function(){
        this.$el.find('.body .com_box_page.two > div').remove();
        this.$el.find('.head .com_box_page.two > div').remove();
    }
});

pointer['com_groupsViewTwo'] = Backbone.View.extend({
    initialize: function(){
        var t = this;
        this.render();
    },
    render: function(){
        var group = this.model;
        var contactPageTwo = _.template( $('#com_bar_group_info_template').html(),{
            group_pk        : group.get('group_pk'),
            phone   : group.getFormattedPhone(),
            address : group.getFormattedAddress(),
            email   : group.get('email'),
            website : group.get('website')
        });
        var contactPageTwoHead = _.template( $('#com_bar_pop_head_2_template').html(),{
            title   : group.get('name'),
            back    : 'Groups'
        });
        this.$el.find('.head .com_box_page.two').html(contactPageTwoHead);
        this.$el.find('.body .com_box_page.two').html(contactPageTwo);
        
        this.$el.find('.body .com_box_page.two .qmi').initQmi();
    },
    events: {
        'click .head .com_box_page.two .com_pop_header_btn_back': 'goBack',
        'mouseup .body .com_box_page.two .messaging_btn': 'message'
    },
    goBack: function(){
        var t = this;
        pointer['com_groups_view'].goToPage(1,t);
        this.$el.find('.body .com_box_page.two > div').fadeOut(400,function(){
            t.undelegateEvents();
            t.remove();
        });
    },
    message: function(){
    
        $('body').click();
        $('.com_messages.com_btn').click();
        
        var t = this;
        var item = t.model;
        var pk = item.get('group_pk') ? 'g'+item.id : item.id,
            group_pk = item.get('group_pk') || null,
            mdl;
        
        mdl = com_conversations.where({
            recipient_pk: pk,
            group_pk: group_pk
        })[0];
        
        if ( !mdl ) {
            com_conversations.add({
                recipient_pk: pk,
                recipient_name: item.get('name'),
                group_pk: group_pk,
                messagesCollection: null
            },{silent:true});
            
            mdl = com_conversations.where({
                recipient_pk: pk,
                group_pk: group_pk
            })[0];
        }
        
        t.undelegateEvents();
        t.remove();
        
        
        pointer['viewMessages'] = new ComPopMessagesView({
            el: pointer['com_conversations_view'].$el,
            model: mdl
        });
        
        pointer['com_conversations_view'].goToPage(2);
        
    },
    remove: function(){
        this.$el.find('.body .com_box_page.two > div').remove();
        this.$el.find('.head .com_box_page.two > div').remove();
    }
});

pointer['com_share_messageViewThree'] = Backbone.View.extend({
    initialize: function() {
    
        this.render();
        
        this.model.get('messagesCollection').on('add',function(msg,opt) {
            console.log('the message was saved');
        });
        
    },
    render: function() {
    
        var t = this;
        var mdl = t.model,
            linktext = $('.com_share_link_text').text() || document.title;
            
        t.share_link = window.location;
        t.share_linktext = linktext;
        
        t.$('.head .com_box_page.three').html(
            _.template( $('#com_bar_pop_head_2_template').html(),{
                title: mdl.get('recipient_name'),
                back: mdl.get('group_pk') ? 'Groups' : 'Contacts'
            })
        );
        t.$('.body .com_box_page.three').html(
            _.template( $('#com_bar_pop_share_message_template').html(), {
                name: mdl.get('recipient_name'),
                title: linktext,
                url: window.location
            })
        );
        
    },
    events: {
        'click .head .com_box_page.three .com_pop_header_btn_back': 'goBack',
        'click .body .newMsg_send.btn': 'sendMessage',
        'keydown .body .newMsg_message': 'checkEnter'
    },
    sendMessage: function() {
        
        var t = this;
        var m = t.model,
            msgbox = t.$('.newMsg_message');
        var msg = [msgbox.val()];
        
        pointer['com_pop_body_overlay'] = new ComPopBodyOverlay({
            el: t.$('.body .com_box_page.three'),
            text: 'Sending...'
        });
    
        msg.push('[[br]][[br]]');
        msg.push(t.share_link);
        
        var col = m.get('messagesCollection');
        
        col.create({
            sent: 1,
            group_pk: m.get('group_pk') || null,
            body: msg.join(''),
            recipient_pk: m.get('recipient_pk'),
            recipient_name: m.get('recipient_name')
        });
        
        msgbox.val('');
        pointer['com_pop_body_overlay'].responseRemove('Sent',function(){
            t.goBack();
        });
        pointer['com_conversations_view'].updateList();
        
    },
    checkEnter: function(e) {
    
        if ( e.keyCode == '13' ) {
            e.preventDefault();
            this.sendMessage();
        }
        
    },
    goBack: function(){
        var t = this;
        pointer['com_share_view'].goToPage(2,t);
        this.$el.find('.body .com_box_page.three > div').fadeOut(400,function(){
            t.undelegateEvents();
            t.remove();
        });
    },
    remove: function(){
        this.$el.find('.body .com_box_page.three').children().remove();
        this.$el.find('.head .com_box_page.three').children().remove();
        this.model.off(null, null, this);
    }
});

pointer['com_share_messageViewThree_gift'] = Backbone.View.extend({
    initialize: function() {
        
        this.render();
        
    },
    render: function() {
        
        var t = this;
        var mdl = t.model;
        
        t.$('.head .com_box_page.three').html(
            _.template( $('#com_bar_pop_head_2_template').html(),{
                title: 'Login',
                back: mdl.get('group_pk') ? 'Groups' : 'Contacts'
            })
        );
        t.$('.body .com_box_page.three').html(
            _.template( $('#com_bar_pop_share_message_gift_login_template').html(), {
                name: mdl.get('recipient_name'),
                price: share_price,
                username: username
            })
        );
        
    },
    events: {
        'click .head .com_box_page.three .com_pop_header_btn_back': 'goBack',
        'keydown .body [name="password"]': 'checkEnter',
        'click #confirm_password': 'confirm'
    },
    confirm: function() {
    
        var t = this;
    
        pointer['com_pop_body_overlay'] = new ComPopBodyOverlay({
            el: t.$('.body .com_box_page.three'),
            text: 'Confirming...'
        });
        
        $.post('/shop/check-auth/username/'+username+'/password/'+t.$('[name="password"]').val())
            .success(function(d) {
            
                if (d) {
                    pointer['com_share_four'] = new pointer['com_share_messageViewFour_gift_list_cards']({
                        model: t.model,
                        el: t.$el
                    });
                } else {
                    pointer['com_pop_body_overlay'].response('Incorrect Password',function(){
                        // just fade out
                    });
                }
                
            });
        
    },
    checkEnter: function(e) {
    
        if ( e.keyCode == '13' ) {
            e.preventDefault();
            this.confirm();
        }
        
    },
    goBack: function() {
    
        var t = this;
        
        pointer['com_share_view'].goToPage(2,t);
        
        t.$('.body .com_box_page.three > div').fadeOut(400,function() {
        
            t.undelegateEvents();
            t.remove();
            
        });
        
    },
    remove: function() {
    
        var t = this;
        
        t.$('.body .com_box_page.three').children().remove();
        t.$('.head .com_box_page.three').children().remove();
        
    }
});

pointer['com_share_messageViewFour_gift_list_cards'] = Backbone.View.extend({
    initialize: function() {

        this.render();
        
    },
    render: function() {
        
        var t = this;
        var mdl = t.model;
        var cardsList = [];
        
        $.get('/shop/get-credit-card')
            .success(function(d) {
                
                $.each(d, function(k,v) {
                
                    cardsList.push(
                        _.template( $('#com_bar_pop_share_message_gift_cards_li_template').html(), {
                            id: v.id,
                            hash: v.hash,
                            ccdate: v.ccdate
                        })
                    );
                    
                });
        
                t.$('.head .com_box_page.four').html(
                    _.template( $('#com_bar_pop_head_2_template').html(),{
                        title: 'Select a Card',
                        back: 'Login'
                    })
                );
                t.$('.body .com_box_page.four').html(
                    _.template( $('#com_bar_pop_share_message_gift_cards_template').html(), {
                        name: mdl.get('recipient_name'),
                        price: share_price,
                        cards: cardsList.join('')
                    })
                );
                
                pointer['com_pop_body_overlay'].remove(function(){
                    // Next
                });
                
                pointer['com_share_view'].goToPage(4);
                
            })
            .error(function() {
                console.log('error gettings cards');
            });
        
    },
    events: {
        'click .head .com_box_page.four .com_pop_header_btn_back': 'goBack',
        'click .sharebox_cards_new': 'showNewCardForm',
        'click #select_card': 'selectCard'
    },
    showNewCardForm: function() {
        
        this.$('.sharebox_cards_new_form')
            .show()
            .find('[type="radio"]')
                .attr('checked','checked')
            .end()
            .find('[name="cc_number"]')
                .focus();
        this.$('.sharebox_cards_new').hide();
        
    },
    selectCard: function() {
        
        var t = this;
        var data = t.$('#sharebox_form_cards').serialize();
        
        pointer['com_pop_body_overlay'] = new ComPopBodyOverlay({
            el: t.$('.body .com_box_page.four'),
            text: 'Checking card...'
        });
        
        data = data.replace(/\+/g,'');//remove spaces
        data = data.replace(/\-/g,'');//remove spaces
        data = data.replace(/\%2F/g,'');//remove slashes
        
        $.post('/shop/auth-only',data)
            .success(function(d) {
                
                if (d.response_code == 1) {
                    pointer['com_share_five'] = new pointer['com_share_messageViewFive_gift_confirm']({
                        model: t.model,
                        el: t.$el,
                        trans_id: d.trans_id,
                        url: window.location,
                        linktext: $('.com_share_link_text').text() || document.title
                    });
                
                    pointer['com_pop_body_overlay'].remove(function(){
                        // Next
                    });
                    
                    pointer['com_share_view'].goToPage(5);
                } else {
                    
                }
                
            })
            .error(function(d) {
                
                
                
            });
        
    },
    goBack: function() {
    
        var t = this;
        
        pointer['com_share_view'].goToPage(3,t);
        
        t.$('.body .com_box_page.four > div').fadeOut(400,function() {
        
            t.undelegateEvents();
            t.remove();
            
        });
        
    },
    remove: function() {
    
        var t = this;
        
        t.$('.body .com_box_page.four').children().remove();
        t.$('.head .com_box_page.four').children().remove();
        
    }
});

pointer['com_share_messageViewFive_gift_confirm'] = Backbone.View.extend({
    initialize: function() {
        
        this.render();
        
    },
    render: function() {
        
        var t = this;
        var mdl = t.model;
        
        t.$('.head .com_box_page.five').html(
            _.template( $('#com_bar_pop_head_2_template').html(),{
                title: 'Confirm',
                back: 'Cards'
            })
        );
        t.$('.body .com_box_page.five').html(
            _.template( $('#com_bar_pop_share_message_gift_confirm_template').html(), {
                name: mdl.get('recipient_name'),
                price: share_price,
                url: t.options.url,
                title: t.options.linktext
            })
        );
        
    },
    events: {
        'click .head .five .com_pop_header_btn_back': 'goBack',
        'click .body .five .newMsg_send': 'confirm'
    },
    confirm: function() {
    
        pointer['com_pop_body_overlay'] = new ComPopBodyOverlay({
            el: t.$('.body .five'),
            text: 'Sending...'
        });
        
        var t = this;
        var m = t.model;
        var col = m.get('messagesCollection');
        
        msg = [ t.$('.five .newMsg_message').val(),
                '<br /><br /><a href="',
                t.options.url,
                '">',
                t.options.linktext,
                '</a>'].join('');
        
        col.create({
            sent: 1,
            group_pk: m.get('group_pk') || null,
            body: msg,
            recipient_pk: m.get('recipient_pk'),
            recipient_name: m.get('recipient_name'),
            trans_id: t.options.trans_id
        },{error: function() {
        
            pointer['com_pop_body_overlay'].responseRemove('Message Sending Failure.',function() {
                //nothing
            });
            
        }});
        
        pointer['com_pop_body_overlay'].responseRemove('Your gift was sent!',function() {
        
            $('body').click();
            
        });
        
    },
    checkEnter: function(e) {
    
        if ( e.keyCode == '13' ) {
            e.preventDefault();
            this.confirm();
        }
        
    },
    goBack: function() {
    
        var t = this;
        
        pointer['com_share_view'].goToPage(4,t);
        
        t.$('.body .com_box_page.five > div').fadeOut(400,function() {
        
            t.undelegateEvents();
            t.remove();
            
        });
        
    },
    remove: function() {
    
        var t = this;
        
        t.$('.body .com_box_page.five').children().remove();
        t.$('.head .com_box_page.five').children().remove();
        
    }
});



// Create Collections
// items are added to these collections in com_bar layout
var com_contacts            = new ComContacts(),
    com_contact_requests    = new ComContactRequests(),
    com_contact_pendings    = new ComContactPendings(),
    com_groups              = new ComGroups(),
    com_conversations       = new ComConversations();

$(window).load(function() {
	
    var com_bar = new ComBarView({
        el: $('#com_bar'),
        easing: 'easeOutExpo',
        speed: 1000
    });
    
    if (com_auth) {
    
        //loadXMLDoc();
    
        // load contacts
        pointer['com_contacts_view'] = new ComPopListView({
            ns: 'com_contacts', //namespace
            listName: 'Contacts',
            collection: com_contacts,
            requests: com_contact_requests,
            pendings: com_contact_pendings
        });
        
        // load groups
        pointer['com_groups_view'] = new ComPopListView({
            ns: 'com_groups', //namespace
            listName: 'Groups',
            collection: com_groups
        });
        
        // load messages
        pointer['com_conversations_view'] = new ComPopConversationsView({
            ns: 'com_conversations', //namespace
            listName: 'Messages',
            collection: com_conversations
        });
        
        // load share
        pointer['com_share_view'] = new ComPopShareView({
            ns: 'com_share', //namespace
            listName: 'Share'
        });
    }
    
    if ( $('.btn').exists() ) {
        $('.btn').unselectable();
    }
});
