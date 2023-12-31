import {
    NotificationCreationAttributes,
    Notifications,
} from '../models/notifications'
import { TypeNotifications } from '../models/type-notifications'
import { AppEventsMap } from './emitter/app-events-map'
import { APP_EVENTS } from './emitter/emit.interface'
import { emitterService } from './emitter/emitter.service'
import {
    SocketService,
    SocketWithAuthenticationService,
} from './socket/socket.service'
import { UserService, userService } from './user.service'

/**
 * Service that abstracts away the
 * operation of sending notifications
 * to users through a {@link socketService.io} Server
 *
 * It registers event listeners to
 * many events on the application to send
 * notifications when those happen
 */
export class NotificationService {
    private socketService: SocketService

    constructor(
        private eventEmitter: typeof emitterService,
        private notificationModel: typeof Notifications,
        private typeNotificationModel: typeof TypeNotifications,
        private userService: UserService
    ) {}

    /**
     * Attach the notification service to a
     * Websocket server
     */
    attach(server: SocketWithAuthenticationService) {
        this.socketService = server
        this.registerListeners()
        // We implement a socket to
        // send notifications to users
        this.socketService.useMiddleware((socket, next) => {
            socket.on('get-notifications', async () => {
                // If socket is authenticated, we send notifications
                // else, we pass to the next handlers
                // action
                if (!socket.data.userId) return next()
                const notifications = await this.notificationModel
                    .findAll({
                        where: { userId: socket.data.userId },
                        order: [['createdAt', 'DESC']],
                    })
                    .then((notes) => {
                        return notes.map(async (n) => {
                            const type =
                                await this.typeNotificationModel.findByPk(
                                    n.typeId
                                )
                            return { ...n.dataValues, type }
                        })
                    })
                this.socketService.emitEventToRoom(
                    'all-notifications',
                    await Promise.all(notifications),
                    socket.data.userId
                )
            })

            // Mark a notification as read
            socket.on(
                'read-notifications',
                async (notificationIds: number[]) => {
                    if (!socket.data.userId) return next()
                    await this.notificationModel.update(
                        { read: true },
                        {
                            where: {
                                id: notificationIds,
                                userId: socket.data.userId,
                            },
                        }
                    )
                }
            )

            // Clear notifications
            socket.on('clear-notifications', async () => {
                if (!socket.data.userId) return next()
                await this.notificationModel.destroy({
                    where: {
                        userId: socket.data.userId,
                    },
                })
                this.socketService.emitEventToRoom(
                    'all-notifications',
                    [],
                    socket.data.userId
                )
            })

            // Declare an event to notify about a timer
            // being done
            socket.on('timer-work-done', async () => {
                this.eventEmitter.emit(
                    APP_EVENTS.TIMER.WORK_DONE,
                    undefined,
                    socket.data.userId
                )
            })

            socket.on('timer-free-done', async () => {
                this.eventEmitter.emit(
                    APP_EVENTS.TIMER.FREE_DONE,
                    undefined,
                    socket.data.userId
                )
            })

            // Declare an event to notify about
            // a possible collaboration contact
            socket.on('colaboration-contact', async (contactedUserId) => {
                const currentUser = await this.userService.findById(
                    socket.data.userId
                )
                if (!currentUser) return
                console.log('==============================')
                console.log(
                    `El usuario ${currentUser.name} se ha contactado con ${contactedUserId}`
                )
                console.log('==============================')
                this.eventEmitter.emit(
                    APP_EVENTS.COLABORATION.CONTACT,
                    currentUser,
                    contactedUserId 
                )
            })

            next()
        })
    }
    /**
     * Maps Application Events {@link APP_EVENTS}
     * to {@link TypeNotifications} instances's IDs
     */
    static eventsToTypeNotifications: {
        [k in keyof AppEventsMap]?: number
    } = {
        [APP_EVENTS.EVENT.CLOSE]: 1,
        [APP_EVENTS.TIMER.WORK_DONE]: 2,
        [APP_EVENTS.TIMER.FREE_DONE]: 3,
        [APP_EVENTS.COLABORATION.CONTACT]: 4,
        [APP_EVENTS.COMPLETED_EXERCISE.RECORD]: 5,
    }
    /**
     * Send a notification to a given user
     *
     * @param {Notifications} notification
     */
    private async sendNotification(
        notification: NotificationCreationAttributes,
        requestedContactUserId: number | null = null
    ) {
        const created = await this.notificationModel.create(notification)
        const type = await this.typeNotificationModel.findByPk(
            notification.typeId
        )
        this.socketService.emitEventToRoom(
            'new-notification',
            {
                ...created.dataValues,
                type,
                requestedContactUserId,
            },
            notification.userId
        )
    }

    /**
     * Finds all notifications given its userId
     */
    private async findAll(userId: number) {
        return this.notificationModel.findAll({
            where: { userId },
        })
    }
    /**
     * Returns the type notification id
     * associated with a given event
     */
    getTypeNotificationForEvent(eventName: keyof AppEventsMap) {
        return NotificationService.eventsToTypeNotifications[eventName]
    }

    registerTimerEvents() {
        this.eventEmitter.on(APP_EVENTS.TIMER.WORK_DONE, async (_, userId) => {
            const id = this.getTypeNotificationForEvent(
                APP_EVENTS.TIMER.WORK_DONE
            )
            this.sendNotification({
                read: false,
                typeId: id,
                title: `Temporizador terminado`,
                content: 'Tómate un descanso',
                userId: userId,
            })
        })

        this.eventEmitter.on(APP_EVENTS.TIMER.FREE_DONE, async (_, userId) => {
            const id = this.getTypeNotificationForEvent(
                APP_EVENTS.TIMER.FREE_DONE
            )
            this.sendNotification({
                read: false,
                typeId: id,
                title: `Temporizador terminado`,
                content: '¡A trabajar!',
                userId: userId,
            })
        })
    }

    registerColaborationEvents() {
        this.eventEmitter.on(
            APP_EVENTS.COLABORATION.CONTACT,
            async (userThatRequestedContact, sentTo) => {
                const id = this.getTypeNotificationForEvent(
                    APP_EVENTS.COLABORATION.CONTACT
                )
                this.sendNotification(
                    {
                        read: false,
                        typeId: id,
                        title: `Nuevo contacto`,
                        content: `El usuario ${userThatRequestedContact.name} te ha agregado como contacto`,
                        userId: sentTo,
                    },
                    userThatRequestedContact.id
                )
            }
        )
    }

    registerCompletedExerciseEvents() {
        this.eventEmitter.on(
            APP_EVENTS.COMPLETED_EXERCISE.RECORD,
            async (data, userId) => {
                const id = this.getTypeNotificationForEvent(
                    APP_EVENTS.COMPLETED_EXERCISE.RECORD
                )
                this.sendNotification({
                    read: false,
                    typeId: id,
                    title: `Récord de ejercicios completados`,
                    content: `Has completado ${data} ejercicios`,
                    userId: userId,
                })
            }
        )
    }

    registerCalendarEvents() {
        this.eventEmitter.on(APP_EVENTS.EVENT.CLOSE, async (event, userId) => {
            const id = this.getTypeNotificationForEvent(APP_EVENTS.EVENT.CLOSE)
            this.sendNotification({
                read: false,
                typeId: id,
                title: `Evento próximo`,
                content: `Un evento se acerca: ${event.title}`,
                userId: userId,
            })
        })
    }

    /**
     * Register listeners for any events
     * from which we want to send notifications
     */
    private registerListeners() {
        this.registerTimerEvents()
        this.registerColaborationEvents()
        this.registerCompletedExerciseEvents()
        this.registerCalendarEvents()
    }
}

export const notificationService = new NotificationService(
    emitterService,
    Notifications,
    TypeNotifications,
    userService
)
