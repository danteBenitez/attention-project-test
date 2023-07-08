import { Models } from '../db'
import { hashPassword, comparePassword } from '../utils/hash';
import { createToken } from '../utils/token';
import type { Response, Request } from 'express'
import { Op } from 'sequelize'
import type { Users as TUsers } from '../models/init-models';
import { passport } from '../middleware/passport';

const { Users } = Models;

const loginController = passport.authenticate('local', {
    successRedirect: '/workspace/timer',
    
});

class IncorrectRegisterError extends Error {}

async function registerController(req: Request, res: Response) {

    const { username, password, email } = req.body;

    const hashedPassword = await hashPassword(password);

    let found;
    try {
        found = await Users.findAll({
            where: {
                [Op.or]: {
                    name: username,
                    email: email
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }

    if (found.length == 0) {
        const newUser = await Users.create({
            name: username, 
            password: hashedPassword,
            email: email,
        });
    
        const token = await createToken(newUser.id);

        return res.status(201).json({ token });

    } else if (found.length == 1) {
        return res.sendStatus(400);
    } else {
        throw new IncorrectRegisterError('Too many users with the same name.')
    }
}

// Change password controller
async function changePasswordController(req: Request, res: Response) {

    const { email, password: newPassword } = req.body;
    
    try {
        const foundUser = await Users.findOne({
            where: {
                email
            }
        })
    
        if (!foundUser) {
            return res.sendStatus(400);
        }

        const hashedPassword = await hashPassword(newPassword);

        foundUser.update({
            password: hashedPassword,
            updatedAt: new Date()
        });
        
        return res.sendStatus(201);
    } catch (err) {
        console.error(err);
        return res.sendStatus(500);
    }
}

async function logoutController(_req: Request, res: Response) {
    res.clearCookie('session-token');
    return res.redirect('/login.html');
}

export {
    loginController,
    registerController,
    changePasswordController,
    logoutController
}
