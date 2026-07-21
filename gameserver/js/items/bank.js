/* global databaseHandler, log */
import ItemRoomStore from './itemroomstore.js';
import Messages from '../message.js';

class Bank extends ItemRoomStore {
    constructor(owner, number, items) {
        super(owner, number, items);

        this.typeIndex = 1;
        this.maxNumber = 96;
        this.fullMessage = new Messages.Notify('BANK', 'BANK_FULL');
    }
}

export default Bank;
