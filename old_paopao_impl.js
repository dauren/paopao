var am = require('./am');

function Paopao (host, invites, params) {
    this.start = function() {
        for ( var i = 0; i < this.clients.length; i++ )
            this.moves[i] = {empty: true};
        this.status = 'running';
        this.finished = false;
        this.turn = 0;
        this.current = 0;
        this.levelStartTime = Math.round(new Date().getTime()/1000);
        //console.log(this.timeLeft, this.levelStartTime);
        this.cast();
    };

    this.getResult = function () {
        if (this.playersCount == 1) {
            return {
                'username': this.host.username,
                'users_id': this.host.uid,
                'games_id': 1,
                'games_type': 'single',
                'result': this.points,
                'date': new Date(),
                'string': this.host.username + ' набрал ' + this.points + ' в paopao'
            };
        } else {
            return {
                'todo': 'todo'
            };
        }
    };

    this.reset = function() {
        this.level = 1;
        this.levelTime = 10;
        //this.levelTime = 10;
        this.name = "paopao";
        this.type = params.type || 'public';
        this.playersCount = params.players || 1;
        this.levels = [];
        this.moves = [{}, {}, {}, {}];
        //this.n = 9;
        //this.m = 16;
        this.n = 3;
        this.m = 4;
        this.lastMove = {};
        this.field = [];
        //this.id = id;
        this.path = [];
        this.lifes = 5;
        this.points = 0;
        this.nt;
        this.fill();
        this.shuffle();
    }

    this.init = function() {
        this.reset();
        Paopao.prototype.init.call(this, host, invites, params);
    }
    this.shuffle = function() {
        var nt = 0, t = [];
        for ( var i = 0; i < this.n; i++ )
            for ( var j = 0; j < this.m; j++ )
                if (this.field[i][j] != ' ') {
                    t[nt] = {i: i, j: j};
                    nt++;
                }

        for ( var i = 0; i < nt; i++ ) {
            var t1 = nt-i-1;
            var t2 = Math.floor(Math.random() * (nt-i));
            var c = this.field[t[t1].i][t[t1].j];
            this.field[t[t1].i][t[t1].j] = this.field[t[t2].i][t[t2].j];
            this.field[t[t2].i][t[t2].j] = c;
        }
    };

    this.pause = function () {
        this.status = 'paused';
        this.pauseTime = Math.round(new Date().getTime()/1000);
    }
    this.resume = function () {
        if (!this.isEmpty()) {
            this.lifes--;
            if (this.lifes < 0) {
                this.finish('no lives');
                return;
            } else {
                this.shuffle();
                while (!this.hasMove())
                    this.shuffle();
            }
        }
        this.status = 'running';
        this.levelStartTime += Math.round(new Date().getTime()/1000) - this.pauseTime;
    }
    this.toData = function(client, obs) {
        var time = this.levelTime - Math.round(new Date().getTime()/1000) + this.levelStartTime;
        var data = {
            title: 'Текущая игра',
            level: this.level,
            finished: this.finished,
            name: this.name,
            id: this.id,
            type: 'paopao',
            displayName: this.type,
            field: this.field,
            n: this.n,
            m: this.m,
            path: this.path,
            lastMove: this.lastMove,
            lifes: this.lifes,
            time: time,
            points: this.points,
            levelStartTime: this.levelStartTime,
            levelTime: this.levelTime,
            status: this.status,
            moves: this.moves
        };

        if (obs) {
            data.obs = 1;
            return data;
        }
        if ( time < 0 ) {
            //game over
        }
        for ( var i = 0; i < this.clients.length; i++ )
            if (client.id == this.clients[i].id) {
                data.current = this.moves[i];
            } else {
                data.friendCurrent = this.moves[i];
            }

        return data;
    };

    this.adjust = function() {
        function shift (a, dir, p1, p2) {
            if ( dir == 0 ) {
                for ( var i = 0; i < n; i++ ) {
                    var k = p1;
                    if ( p1 < p2 )
                        for ( var j = p1; j <= p2; j++ ) {
                            if (a[i][j] != ' ') {
                                var x = a[i][j];
                                a[i][j] = ' ';
                                a[i][k] = x;
                                k++;
                            }
                        }
                    else
                        for ( var j = p1; j >= p2; j-- ) {
                            if ( a[i][j] != ' ') {
                                var x = a[i][j];
                                a[i][j] = ' ';
                                a[i][k] = x;
                                k--;
                            }
                        }
                }
            } else {
                for ( var j = 0; j < m; j++ ) {
                    var k = p1;
                    if ( p1 < p2 )
                        for ( var i = p1; i <= p2; i++ ) {
                            if (a[i][j] != ' ') {
                                var x = a[i][j];
                                a[i][j] = ' ';
                                a[k][j] = x;
                                k++;
                            }
                        }
                    else
                        for ( var i = p1; i >= p2; i-- ) {
                            if ( a[i][j] != ' ') {
                                var x = a[i][j];
                                a[i][j] = ' ';
                                a[k][j] = x;
                                k--;
                            }
                        }
                }
            }
            return a;
        }
        var m = this.m;
        var n = this.n;
        var a = this.field;

        if (this.level == 2) {
            a = shift(a, 1, n-1, 0);
        } else if (this.level == 3) {
            a = shift(a, 1, 0, n-1);
        } else if (this.level == 4) {
            a = shift(a, 0, 0, m-1);
        } else if (this.level == 5) {
            a = shift(a, 0, m-1, 0);
        } else if ( this.level == 6) {
            var mid = Math.floor((m-1)/2);
            a = shift(a, 0, m-1, mid+1);
            a = shift(a, 0, 0, mid);
            mid = Math.floor((n-1)/2);
            a = shift(a, 1, n-1, mid+1);
            a = shift(a, 1, 0, mid);
        } else if ( this.level == 7 ) {
            var mid = Math.floor((m-1)/2);
            a = shift(a, 0, mid+1, m-1);
            a = shift(a, 0, mid, 0);
            mid = Math.floor((n-1)/2);
            a = shift(a, 1, mid+1, n-1);
            a = shift(a, 1, mid, 0);
        }
    };

    this.hasMove = function() {
        var f = this.field;
        for ( var i = 0; i < this.n; i++ )
            for ( var j = 0; j < this.m; j++ )
                for ( var i1 = 0; i1 < this.n; i1++ )
                    for ( var j1 = 0; j1 < this.m; j1++ )
                        if ( (f[i1][j1] == f[i][j]) && ((i != i1) || (j != j1)) &&
                            (this.check(i, j, i1, j1).ok)) {
                            //console.log('hasMove', i, j, i1, j1);
                            return true;
                        }
        return false;
    };

    this.paramsInfo = function() {
        return '(' + this.playersCount + 'p)';
    };

    this.empty = function(i, j) {
        return (this.field[i][j] == ' ');
    };

    this.fill = function() {
        var curocc = 0;
        var occ = 4;
        var cur = 1;
        for ( var i = 0; i < this.n; i++ ) {
            this.field[i] = [];
            for ( var j = 0; j < this.m; j++ ) {
                this.field[i][j] = cur;
                curocc++;
                if ( curocc == occ) {
                    cur++;
                    curocc = 0;
                }
            }
        }
        this.shuffle();
    };

	this.move = function(data, clientId) {
        this.time = this.levelTime - Math.round(new Date().getTime()/1000) + this.levelStartTime;
        var cast = 0;
        this.path = [];
        var currentClient = this.clients[0];
        var index = 0;
        for ( var i = 0; i < this.clients.length; i++ )
            if (this.clients[i].id == clientId) {
                index = i;
                currentClient = this.clients[i];
                break;
            }

        var result = {};
        if ( data.action == 'timeout') {
            this.finish('timeout');
            cast = 1;
            result.status = 'ok';
        } else if ( data.action == 'cancel') {
            this.moves[index] = {empty:true};
            result.status = 'ok';
            //result.message = 'move canceled';
        } else if (!this.inside(data.i, data.j)) {
            return {status: 'ok'};
        } else if (this.moves[index].empty) {
            if (this.clients.length > 1) {
                var index2 = (index + 1)%2;
                if (!this.moves[index2].empty) {
                    var r = this.check(this.moves[index2].i1, this.moves[index2].j1, data.i, data.j);
                    if (r.ok) {
                        this.lastMove = {type: 'team', i1: this.moves[index2].i1, j1: this.moves[index2].j1, i2: data.i, j2: data.j};
                        this.points += 100;
                        this.path = r.path;
                        this.field[this.moves[index2].i1][this.moves[index2].j1] = ' ';
                        this.moves[index2] = {empty: true};
                        this.field[data.i][data.j] = ' ';
                        this.adjust();
                    }
                }
            }
            if (this.field[data.i][data.j] != ' ') {
                this.moves[index].i1 = data.i;
                this.moves[index].j1 = data.j;
                this.moves[index].empty = false;
            }
            result.status = 'ok';
        } else {
            var r = this.check(this.moves[index].i1, this.moves[index].j1, data.i, data.j);
            if (r.ok) {
                this.lastMove = {i1: this.moves[index].i1, j1: this.moves[index].j1, i2: data.i, j2: data.j};
                this.points += 50;
                this.path = r.path;
                this.field[this.moves[index].i1][this.moves[index].j1] = ' ';
                this.field[data.i][data.j] = ' ';
                this.adjust();
            }
            this.moves[index] = {empty:true};
            if (this.isEmpty()) {
                this.level++;
                if (this.level < 8) {
                    this.lifes++;
                    this.fill();
                    this.shuffle();
                    cast = 1;
                    while (!this.hasMove())
                        this.shuffle();
                    this.levelStartTime = Math.round(new Date()/1000);
                    //add time to points?
                } else {
                    cast = 1;
                    this.finish('victory');
                }
            } else if (!this.hasMove()) {
                this.lifes--;
                if (this.lifes < 0) {
                    cast = 1;
                    this.finish('no lives');
                } else {
                    while (!this.hasMove()) {
                       this.shuffle();
                       cast = 1;
                    }
                }
            }
            result.status = 'ok';
        }

        if ( cast ) {
            this.cast();
        }
        return result;
	};

    this.check = function (i1, j1, i2, j2) {
        if ((!this.empty(i1, j1)) && (( this.inside(i1, j1) && this.inside(i2, j2)) && ((i1 != i2) || (j1 != j2)))
            && (this.field[i1][j1] == this.field[i2][j2])) {
            var r = this.checkInner(i1, j1, i2, j2);
            if ( r.ok )
                return {ok: true, path: r.path};
            r = this.checkOuter(i1, j1, i2, j2);
            if (r.ok)
                return {ok: true, path: r.path};
        }
        return {ok: false};
    };

    this.checkInner = function (i1, j1, i2, j2) {
        var self = this;
        var free = function(i, j) {
            if (((i == i1) && (j == j1)) || ((i == i2) && (j == j2)))
                return true;
            if (self.field[i][j] == ' ')
                return true;
            return false;
        }

        var ifrom, ito, jfrom, jto;
        if ( i1 < i2 ) {
            ifrom = i1; ito = i2;
        } else {
            ifrom = i2; ito = i1;
        }
        if ( j1 < j2 ) {
            jfrom = j1; jto = j2;
        } else {
            jfrom = j2; jto = j1;
        }

        for ( var ti = ifrom; ti <= ito; ti++ ) {
            var ok = true;
            if ( i1 <= i2 ) {
                for ( var i = i1; i <= ti; i++ )
                    if (!free(i, j1)) {
                        ok = false;
                        break;
                    }

                for ( var i = i2; i >= ti; i-- )
                    if (!free(i, j2)) {
                        ok = false;
                        break;
                    }
            } else {
                for ( var i = i1; i >= ti; i-- )
                    if (!free(i, j1)) {
                        ok = false;
                        break;
                    }
                for ( var i = i2; i <= ti; i++ )
                    if (!free(i, j2)) {
                        ok = false;
                        break;
                    }
            }
            if ( j1 <= j2 ) {
                for ( var j = j1; j <= j2; j++ )
                    if (!free(ti, j)) {
                        ok = false;
                        break;
                    }
            } else {
                for ( var j = j1; j >= j2; j-- )
                    if (!free(ti, j)) {
                        ok = false;
                        break;
                    }
            }

            if (!ok)
                continue;

            return {ok: true, path: [
                {i: i1, j: j1}, {i: ti, j: j1}, {i: ti, j: j2}, {i: i2, j: j2}
            ]};
        }

        for ( var tj = jfrom; tj <= jto; tj++ ) {
            var ok = true;
            if ( j1 <= j2 ) {
                for ( var j = j1; j <= tj; j++ )
                    if (!free(i1, j)) {
                        ok = false;
                        break;
                    }
                for ( var j = j2; j >= tj; j-- )
                    if (!free(i2, j)) {
                        ok = false;
                        break;
                    }
            } else {
                for ( var j = j1; j >= tj; j-- )
                    if (!free(i1, j)) {
                        ok = false;
                        break;
                    }
                for ( var j = j2; j <= tj; j++ )
                    if (!free(i2, j)) {
                        ok = false;
                        break;
                    }
            }
            if ( i1 <= i2 ) {
                for ( var i = i1; i <= i2; i++ )
                    if (!free(i, tj)) {
                        ok = false;
                        break;
                    }
            } else {
                for ( var i = i1; i >= i2; i-- )
                    if (!free(i, tj)) {
                        ok = false;
                        break;
                    }
            }
            if (!ok)
                continue;
            return {ok: true, path: [
                {i: i1, j: j1}, {i: i1, j: tj}, {i: i2, j: tj}, {i: i2, j: j2}
            ]};
        }

        return {ok: false};
    };

    this.checkOuter = function (i1, j1, i2, j2) {
        var self = this;
        var free = function(i, j) {
            if ((i == -1) || (i == self.n) || (j == -1) || (j == self.m))
                return true;
            if (((i == i1) && (j == j1)) || ((i == i2) && (j == j2)))
                return true;
            if (self.field[i][j] == ' ')
                return true;
            return false;
        }

        var ifrom, ito, jfrom, jto;
        if ( i1 < i2 ) {
            ifrom = i1; ito = i2;
        } else {
            ifrom = i2; ito = i1;
        }
        if ( j1 < j2 ) {
            jfrom = j1; jto = j2;
        } else {
            jfrom = j2; jto = j1;
        }

        for ( var dt = 1; dt <= this.n; dt++ ) {
            var ok = true;
            var ti = ifrom - dt;
            if (ti >= -1) {
                for ( var i = i1; i >= ti; i-- )
                    if (!free(i, j1)) {
                        ok = false;
                        break;
                    }

                for ( var i = i2; i >= ti; i-- )
                    if (!free(i, j2)) {
                        ok = false;
                        break;
                    }
                for ( var j = jfrom; j <= jto; j++ )
                    if (!free(ti, j)) {
                        ok = false;
                        break;
                    }
                if (ok)
                    return {ok: true, path: [
                        {i: i1, j: j1}, {i: ti, j: j1}, {i: ti, j: j2}, {i: i2, j: j2}
                    ]};
            }

            ok = true;
            var ti = ito + dt;
            if (ti <= this.n) {
                for ( var i = i1; i <= ti; i++ )
                    if (!free(i, j1)) {
                        ok = false; break;
                    }

                for ( var i = i2; i <= ti; i++ )
                    if (!free(i, j2)) {
                        ok = false; break;
                    }
                for ( var j = jfrom; j <= jto; j++ )
                    if (!free(ti, j)) {
                        ok = false; break;
                    }
                if (ok)
                    return {ok: true, path: [
                        {i: i1, j: j1}, {i: ti, j: j1}, {i: ti, j: j2}, {i: i2, j: j2}
                    ]};
            }
        }

        for ( var dt = 1; dt <= this.m; dt++ ) {
            var ok = true;
            var tj = jfrom - dt;
            if (tj >= -1) {
                for ( var j = j1; j >= tj; j-- )
                    if (!free(i1, j)) {
                        ok = false;
                        break;
                    }

                for ( var j = j2; j >= tj; j-- )
                    if (!free(i2, j)) {
                        ok = false;
                        break;
                    }

                for ( var i = ifrom; i <= ito; i++ )
                    if (!free(i, tj)) {
                        ok = false; break;
                    }
                if (ok)
                    return {ok: true, path: [
                        {i: i1, j: j1}, {i: i1, j: tj}, {i: i2, j: tj}, {i: i2, j: j2}
                    ]};
            }

            ok = true;
            var tj = jto + dt;
            if (tj <= this.m) {
                for ( var j = j1; j <= tj; j++ )
                    if (!free(i1, j)) {
                        ok = false; break;
                    }

                for ( var j = j2; j <= tj; j++ )
                    if (!free(i2, j)) {
                        ok = false; break;
                    }

                for ( var i = ifrom; i <= ito; i++ )
                    if (!free(i, tj)) {
                        ok = false; break;
                    }
                if (ok) {
                    //console.log(tj, i1, j1, i2, j2);
                }
                if (ok)
                    return {ok: true, path: [
                        {i: i1, j: j1}, {i: i1, j: tj}, {i: i2, j: tj}, {i: i2, j: j2}
                    ]};
            }
        }
        return {ok: false};
    };

    this.inside = function(x, y) {
        return (( x >= 0) && ( x < this.n ) && ( y >= 0 ) && ( y < this.m));
    };

    this.isEmpty = function() {
        for ( var i = 0; i < this.n; i++ )
            for ( var j = 0; j < this.m; j++ )
                if (this.field[i][j] != ' ')
                    return false;
        return true;
    };

    this.finish = function(status) {
        this.finished = true;
        this.status = status;
    };

    this.init();
}

Paopao.prototype = new am();
module.exports = Paopao;