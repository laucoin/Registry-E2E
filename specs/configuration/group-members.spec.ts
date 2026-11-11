import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { uid } from '@support/unique';

/** Objectif: Couvrir la gestion des membres d'un groupe | Périmètre: invités exclus, ligne, ajout, création, retrait | Limites: un groupe à la fois */
test.describe('Group members', () => {
	test('GRP-02 · a guest is offered neither when creating a group nor when adding members', async ({
		data,
		groupForm,
		groupMembers,
	}) => {
		const project = await data.project();
		const guest = `GUEST-${uid().toUpperCase()}`;
		await data.guestMovement(project.id, {
			type: 'IN',
			reason: 'VISIT',
			guests: [{ firstName: 'Paul', lastName: guest, birthday: '1990-01-01' }],
		});
		const group = await data.group(project.id, []);

		await test.step('Not offered as a member of a new group', async () => {
			await groupForm.openCreation(project.id);
			await groupForm.save(`Owls ${uid()}`);
			await groupForm.members.search(guest);
			await expect(groupForm.nobodyFound).toBeVisible();
		});

		await test.step('Not offered when adding members', async () => {
			await groupMembers.goto(project.id, group.id);
			await groupMembers.openAddMembers();
			await groupMembers.members.search(guest);
			await expect(groupMembers.nobodyFound).toBeVisible();
		});
	});

	test('GRP-03 · a row counts the members inside and outside, and its main button opens the members', async ({
		data,
		groupsList,
		page,
	}) => {
		const project = await data.project();
		const [inside, outside] = [await data.participant(project.id), await data.participant(project.id)];
		await data.participantMovement(project.id, { type: 'IN', participantIds: [inside.id] });
		const name = `Foxes ${uid()}`;
		const group = await data.group(project.id, [inside.id, outside.id], { name });

		await test.step('The row counts the members', async () => {
			await groupsList.goto(project.id);
			await expect(groupsList.row(name).root).toContainText('2 membres (1 · 1)');
		});

		await test.step('The main button opens the members of the group', async () => {
			await groupsList.primaryAction(name).click();
			await expect(page).toHaveURL(new RegExp(`/groups/${group.id}/members`));
		});
	});

	test('GRP-05 · GRP-06 · a member created from the group belongs to it, and removing the last one empties it', async ({
		data,
		groupMembers,
		participantForm,
	}) => {
		const project = await data.project();
		const group = await data.group(project.id, []);
		const lastName = `CREATED-${uid().toUpperCase()}`;

		await test.step('Create a member from the group', async () => {
			await groupMembers.goto(project.id, group.id);
			await groupMembers.openMemberCreation();
			await participantForm.save({ firstName: 'Mary', lastName, birthday: '01/02/2008' });
			await expect(groupMembers.row(lastName).root).toBeVisible();
		});

		await test.step('Remove the last member after confirming', async () => {
			await groupMembers.remove(lastName);
			await expect(groupMembers.rows).toHaveCount(0);
		});
	});
});

test.describe('Group members added by a project participant', () => {
	test.use({ storageState: authFile('participant') });

	test('GRP-04 · a project participant adds members, at least one', async ({ data, groupMembers }) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const lastName = `ADDED-${uid().toUpperCase()}`;
		await data.participant(project.id, { firstName: 'Rosa', lastName });
		const group = await data.group(project.id, []);

		await test.step('Adding nobody is refused', async () => {
			await groupMembers.goto(project.id, group.id);
			await groupMembers.openAddMembers();
			await groupMembers.add();
			await expect(groupMembers.membersField).toHaveAttribute('error', /.+/);
		});

		await test.step('The chosen participant becomes a member', async () => {
			await groupMembers.members.choose(`Rosa ${lastName}`);
			await groupMembers.add();
			await expect(groupMembers.row(lastName).root).toBeVisible();
		});
	});
});
