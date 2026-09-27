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
            try {
                const user = await Users.findOne({ Username: username });
                if (!user) {
                    return callback(null, false, { message: 'Incorrect username or password.' });
                }
                if (!user.validatePassword(password)) {
                    return callback(null, false, { message: 'Incorrect password.' });
                }
                return callback(null, user);
            } catch (error) {
                return callback(error);
            }
        }
    )
);

passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
},  async (jwtPayload, callback) => {
    try {
        const user = await Users.findById(jwtPayload._id);
        return callback(null, user);
    } catch (error) {
        return callback(error);
    }
}));
