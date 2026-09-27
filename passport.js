const passport = require ('passport'),
    LocalStrategy = require ('passport-local').Strategy,
    Models = require ('./models.js'),
    passportJWT = require ('passport-jwt');
const { jwtSecret } = require('./config');

let Users = Models.User,
    JWTStrategy = passportJWT.Strategy,
    ExtractJWT = passportJWT.ExtractJwt;

passport.use(
    new LocalStrategy(
        {
            usernameField: 'Username',
            passwordField: 'Password',
        },
        async (username, password, callback) => {
            await Users.findOne({ Username: username })
                .then((user) => {
                    if (!user) {
                        return callback(null, false, { message: 'Incorrect username or password.' });
                    }
                    if (!user.validatePassword(password)) {
                        return callback(null, false, { message: 'Incorrect password.' });
                    }
                    return callback(null, user);
                })
                .catch((error) => {
                    if (error) {
                        return callback(error);
                    }
                });
        }
    )
);

passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
},  async (jwtPayload, callback) => {
    return await Users.findById(jwtPayload._id)
        .then((user) => {
            return callback(null, user);
        })
        .catch((error) => {
            return callback(error)
        });
}));
