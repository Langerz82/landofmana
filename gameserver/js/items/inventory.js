/* global databaseHandler, log */
import ItemRoomStore from './itemroomstore.js';
import Messages from '../message.js';

class Inventory extends ItemRoomStore {
    constructor(owner, number, items) {
        super(owner, number, items);

        this.typeIndex = 0;
        this.maxNumber = 50;
        this.fullMessage = new Messages.Notify('INVENTORY', 'INVENTORY_FULL');
    }
}

export default Inventory;
