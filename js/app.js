(function () {
    // App
    window.RF = Em.Application.create({
        app_name: 'ReddieFox'
    });

    // Globals
    RF.redditURL = 'http://www.reddit.com/';
    RF.homeRoute = 'subreddits';

    // Setup database
    RF.db = $.indexedDB('ReddieFox', {
        version: 1,
        schema: {
            '1': function (tx) {
                var srStore = tx.createObjectStore('subreddit', {keyPath: 'id'});
                srStore.createIndex('id', 'id', {unique: true});
            }
        }
    });

    // Models
    RF.Link = Em.Object.extend();

    RF.Comment = Em.Object.extend();

    RF.Subreddit = Em.Object.extend({
        links: Em.A(),
        loaded: false,
        load: function () {
            if (this.get('loaded')) return;
            var subr = this;
            $.getJSON(RF.redditURL + this.get('url') + '/.json?jsonp=?')
                .then(function(response) {
                    var links = Em.A();
                    response.data.children.forEach(function (child) {
                        links.pushObject(RF.Link.create(child.data));
                    });
                    subr.set('links', links);
                    subr.set('loaded', true);
                });
            
            RF.Subreddit.about(this.get('url'))
                .then(function(response) {
                    for (var key in response.data) {
                        if (!subr.get(key)) {
                            subr.set(key, response.data[key]);
                        }
                    };
                });
        }
    });

    RF.Subreddit.reopenClass({
        about: function (url) {
            return $.getJSON(RF.redditURL + url + '/about.json?jsonp=?');
        },
        find: function(id) {
            var retVal = id ? RF.Subreddit.create() : Em.A();
            if (!id) {
                RF.db.objectStore('subreddit')
                    .each(function (item) {
                        retVal.pushObject(
                            RF.Subreddit.create(item.value)
                        );
                    });
            } else {
                RF.db.objectStore('subreddit')
                    .get(id)
                    .done(function (result, e) {
                        retVal = RF.Subreddit.create(result);
                    });
            }
            return retVal;
        }
    });

    // Controllers
    Em.ControllerMixin.reopen({
        showMenu: function () {
            $('#menu').removeAttr('hidden');
        },
        goHome: function () {
            this.transitionToRoute(RF.homeRoute);
        },
        toRoute: function (routeName) {
            this.transitionToRoute(routeName);
        },
        closeMenu: function () {
            $('#menu').attr('hidden', '');
        },
        menuToRoute: function (routeName) {
            this.closeMenu();
            this.toRoute(routeName);
        }
    });

    RF.ApplicationController = Em.Controller.extend({
        currentPathDidChange: function() {
            path = this.get('currentPath');
            console.log('path changed to: ', path);
        }.observes('currentPath')
    });

    RF.NewController = Em.ObjectController.extend({
        subredditName: '',
        home: true,
        title: 'New',
        errorMessage: '',
        saveSubreddit: function () {
            var c = this;
            var subredditName = c.get('subredditName');
            if (subredditName) {
                RF.Subreddit.about('/r/' + subredditName)
                    .then(function (response) {
                        var sr = response.data;
                        RF.db.objectStore('subreddit')
                            .get(sr.id)
                            .done(function (result, e) {
                                if (!result) {
                                    RF.db.objectStore('subreddit')
                                        .add(sr)
                                        .done(function () {
                                            c.transitionToRoute(RF.homeRoute);
                                        })
                                        .fail(function () { c.set('errorMessage', 'An error ocurred while trying to bookmark the given Subreddit');});
                                } else {
                                    c.set('errorMessage', 'The Subreddit already exists');
                                }
                            });
                    })
                    .fail(function () { c.set('errorMessage', 'An error ocurred while trying to bookmark the given Subreddit');});
            } else {
                c.set('errorMessage', 'You need to supply a Subreddit name');
            }
        }        
    });

    // Views
    RF.ApplicationView = Em.View.extend();

    RF.HeaderView = Em.View.extend({
        templateName: 'header'
    });

    RF.MenuView = Em.View.extend({
        templateName: 'menu'
    });

    // Routes
    RF.Router.map(function () {
        this.resource('subreddits', {path: '/'});
        this.resource('new', {path: '/_new'});
        this.resource('subreddit', {path: '/:subreddit_id'});
    });

    Em.Route.reopen({
        renderTemplate: function () {
            this.render();
            this.render('header', {
                into: 'application',
                outlet: 'header'
            });
        }
    });

    RF.SubredditsRoute = Em.Route.extend({
        model: function () {
            return RF.Subreddit.find();
        }
    });

    RF.SubredditRoute = Em.Route.extend({
        model: function (params) {
            return RF.Subreddit.find(params.subreddit_id);
        },
        serialize: function (model) {
            return {subreddit_id: model.get('id')};
        },
        setupController: function (controller, model) {
            controller.set('back', 'subreddits');
            model.load();
        }
    });

    RF.NewRoute = Em.Route.extend({
        home: true
    });

    RF.IndexRoute = Em.Route.extend({
        redirect: function () {
            var route = this;
            route.transitionTo(
                RF.homeRoute
            );
        }
    });

    // Custom helpers
    Ember.Handlebars.registerBoundHelper('tsFromNow', function (ts) {
        return moment.unix(ts).fromNow();
    });

    var showdown = new Showdown.converter();

    Ember.Handlebars.registerBoundHelper('markdown', function (md) {
        return new Ember.Handlebars.SafeString(
            showdown.makeHtml(md)
        );
    });    
})();
