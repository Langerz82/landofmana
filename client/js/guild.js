// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Guild {
    constructor(id, name) {
        this.members = [];
        this.id = id;
        this.name = name;
    }

    addMembers(membersList) {
        this.members = [...new Set([...this.members, ...membersList])];
    }

    removeMembers(membersList) {
        this.members = this.members.filter((m) => !membersList.includes(m));
    }

    listMembers(iterator) {
        return this.members.filter(iterator);
    }
}
