// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Guild {
        constructor(id, name) {
           this.members = [];//name
           this.id = id;
           this.name = name;
        }
        /* Maybe useful later… see #updateguild tag */
        addMembers(membersList) {
			//maybe we could have tested the form of the array…
			this.members = _.union(this.members, membersList);
        }

        removeMembers(membersList) {
			this.members = _.difference(this.members, membersList);
		}

		listMembers(iterator) {
			return _.filter(this.members, iterator);
		}
}
