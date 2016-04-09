((ng, App) => {
    'use strict';

    App.factory('MatchesCache', (Store, MatchModel) => new class MatchesCache {
        constructor() {
            this.store = new Store('Cache');
        }

        get profile() {
            return this.store.get('profile').catch(() => ({}));
        }

        set profile(value) {
            this.store.set('profile', value);
        }

        /**
         * @returns {Promise.<Date>}
         */
        get activity() {
            return this.store.get('activity').then((activity) => {
                return new Date(activity);
            }, () => {
                var activity = new Date(),
                    interval = 1000 * 60 * 60 * 24 * 31 * 12 * 10;
                activity.setTime(activity.getTime() - interval);
                return activity;
            });
        }

        //noinspection JSAnnotator
        /**
         * @param {Date} value
         */
        set activity(value) {
            this.store.set('activity', value.toISOString());
        }

        /**
         * @returns {*|Promise.<Array<MatchModel>>}
         */
        get matches() {
            return this.store.get('matches').then(
                (matches) => matches.map((v) => new MatchModel(v)),
                () => []
            );
        }

        //noinspection JSAnnotator
        /**
         * @param {Array<MatchModel>} value
         */
        set matches(value) {
            this.store.set('matches', value.map((v) => v.toObject()));
        }

        reset() {
            return Promise.all([
                this.store.remove('profile'),
                this.store.remove('activity'),
                this.store.remove('matches')
            ]);
        }
    });

    App.controller('MatchesController', class MatchesController {
        /**
         * @param $scope
         * @param {MatchesCache} MatchesCache
         */
        constructor($scope, MatchesCache) {
            /**
             * @type {Array<MatchModel>}
             */
            $scope.matches = [];

            /**
             * @type {MatchModel|null}
             */
            $scope.active = null;

            /**
             * @type {string}
             */
            $scope.message = '';

            $scope.refresh = () => {
                $scope.loading = true;
                Promise.all([
                    MatchesCache.activity,
                    MatchesCache.matches
                ]).then(([activity, matches]) => $scope.client.updates(activity).then((update) => {
                    let merged = merge(matches, update.matches);
                    MatchesCache.activity = update.activity;
                    MatchesCache.matches = merged;
                    return merged;
                })).then((matches) => {
                    $scope.loading = false;
                    $scope.matches = matches;
                    $scope.active = matches.length ? matches[0] : null;
                    $scope.$apply();
                });
            };

            $scope.dialog = (match) => {
                $scope.active = match;
            };
        
            $scope.send = (match, message) => {
                $scope.loading = true;
                $scope.client.send(match.id, message).then(() => {
                    $scope.message = '';
                    $scope.loading = false;
                    $scope.refresh();
                    $scope.$apply();
                }, () => {
                    $scope.matches = [];
                    $scope.loading = false;
                    $scope.refresh();
                    $scope.$apply();
                });
            };

            $scope.$watch('client', (value) => {
                if (value !== null) {
                    $scope.refresh();
                }
            });

            /**
             * @param {Array<MatchModel>} cached
             * @param {Array<MatchModel>} fetched
             * @returns {Array<MatchModel>}
             */
            function merge(cached, fetched) {
                let results = ng.copy(cached);

                for (let match of fetched) {
                    let merged = false;

                    // Merge match.
                    for (let result of results) if (result.id == match.id) {
                        for (let attr of ['activity', 'person', 'messages']) if (match[attr]) {
                            result[attr] = match[attr];
                        }
                        merged = true;
                        break;
                    }

                    // Insert new match.
                    if (!merged) {
                        results.push(match);
                    }

                    // Sort messages
                    match.messages.sort((a, b) => b.sent - a.sent);
                }

                // Sort matches.
                return results.sort((a, b) => b.activity - a.activity);
            }
        }
    });
})(angular, App);