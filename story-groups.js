function* genPairs(iterable) {
    for (let i = 0;i < iterable.length;i++) {
        for (let k = i + 1;k < iterable.length;k++) {
            yield canonicalizePair({first: iterable[i], second: iterable[k]});
        }
    }
}

function canonicalizePair({first, second}) {
    const asList = [first, second];
    asList.sort();
    return {first: asList[0], second: asList[1]};
}

class IncidenceMap {
    map = new Map();

    incrementForPair(pair) {
        let firstMap = this.map.get(pair.first);
        if (firstMap === undefined) {
            firstMap = new Map();
            this.map.set(pair.first, firstMap);
        }
        const newIncidence = (firstMap.get(pair.second) || 0) + 1;
        firstMap.set(pair.second, newIncidence);
        return newIncidence;
    }

    getForPair(pair) {
        if (!this.map.has(pair.first)) {
            return 0;
        }
        return this.map.get(pair.first).get(pair.second) || 0;
    }
}

class GroupBuilder {
    #members;

    constructor({first, second}) {
        this.#members = [first, second];
    }

    getMembersList() {
        return this.#members;
    }

    getNMembers() {
        return this.#members.length;
    }

    simulateAddingMember(member, incidence) {
        const newMembers = [...this.#members, member];
        let groupIncidence = 0;
        let maxPairIncidence = 0;
        for (let pair of genPairs(newMembers)) {
            const pairIncidence = incidence.getForPair(pair);
            maxPairIncidence = Math.max(maxPairIncidence, pairIncidence);
            groupIncidence += incidence.getForPair(pair);
        }

        return {groupIncidence, maxPairIncidence};
    }

    addMember(member) {
        this.#members.push(member);
    }
}

class NoPossibleSolutionError {}

function buildGroupsForSingleRound(
    participants,
    incidence,
    groupSize,
    max_pair_incidence,
) {
    participantPairs = [...genPairs(participants)];
    participantPairs.sort((a, b) => incidence.getForPair(a) - incidence.getForPair(b));
    
    const unassignedMembers = new Set(participants);
    const groups = [];
    const nGroups = Math.floor(participants.length / groupSize);
    
    // prepopulate groups with the least-incidence pairings
    for (let i = 0;i < nGroups;i++) {
        for (let pair of participantPairs) {
            if (!unassignedMembers.has(pair.first) || !unassignedMembers.has(pair.second)) {
                continue;
            }
            groups.push(new GroupBuilder(pair));
            unassignedMembers.delete(pair.first);
            unassignedMembers.delete(pair.second);
            break;
        }
    }

    const potentialMemberIncidences = [];
    for (let member of unassignedMembers.values()) {
        for (let group of groups) {
            const {groupIncidence, maxPairIncidence} = group.simulateAddingMember(member, incidence);
            if (maxPairIncidence > max_pair_incidence) {
                continue;
            }
            potentialMemberIncidences.push({
                member,
                group,
                groupIncidence,
            });
        }
    }
    if (potentialMemberIncidences.length == 0) {
        throw new NoPossibleSolutionError();
    }

    potentialMemberIncidences.sort((a, b) => a.groupIncidence - b.groupIncidence);
    let nUnassignedBeforeRun;
    do {
        nUnassignedBeforeRun = unassignedMembers.size;
        for (let group of groups) {
            for (let potentialMembership of potentialMemberIncidences) {
                if (potentialMembership.group != group) {
                    continue;
                }
                if (!unassignedMembers.has(potentialMembership.member)) {
                    continue;
                }
    
                potentialMembership.group.addMember(potentialMembership.member);
                unassignedMembers.delete(potentialMembership.member);
                break;
            }
        }

        if (nUnassignedBeforeRun == unassignedMembers.size) {
            throw new NoPossibleSolutionError();
        }
    } while (unassignedMembers.size > 0);

    return groups;
}

function buildGroupsForManyRounds(
    nParticipantsInCourse,
    nParticipantsPerSubGroup,
    nRounds,
) {
    const participants = Array.from({length: nParticipantsInCourse}, (_, index) => "Participant #" + (index + 1));
    const incidence = new IncidenceMap();
    const roundGroups = [];

    for (let iRound = 0;iRound < nRounds;iRound++) {
        let groups = undefined;
        let tryMaxPairIncidence = 0;
        while (true) {
            try {
                groups = buildGroupsForSingleRound(participants, incidence, nParticipantsPerSubGroup, tryMaxPairIncidence);
                break;
            }
            catch (e) {
                if (e instanceof NoPossibleSolutionError && tryMaxPairIncidence < nRounds / 2) {
                    tryMaxPairIncidence++;
                    continue;
                }
                throw e;
            }
        }

        let iGroup = 0;
        for (let group of groups) {
            iGroup++;
            for (let pair of genPairs(group.getMembersList())) {
                incidence.incrementForPair(pair);
            }
        }
        roundGroups.push(groups);
    }

    return roundGroups;
}