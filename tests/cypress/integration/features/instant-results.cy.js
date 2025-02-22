/* global isEpIo */

describe('Instant Results Feature', () => {
	/**
	 * Create a Search widget.
	 *
	 * As tests for facets will remove all widgets, we recreate it here.
	 */
	function createSearchWidget() {
		cy.openWidgetsPage();
		cy.openBlockInserter();
		cy.getBlocksList().should('contain.text', 'Search'); // Checking if it exists give JS time to process the full list.
		cy.insertBlock('Search');
		cy.intercept('/wp-json/wp/v2/sidebars/*').as('sidebarsRest');
		cy.get('.edit-widgets-header__actions button').contains('Update').click();
		cy.wait('@sidebarsRest');
	}

	before(() => {
		createSearchWidget();

		// Create some sample posts
		cy.publishPost({
			title: 'Blog post',
			content: 'This is a sample Blog post.',
		});
		cy.publishPost({
			title: 'Test Post',
			content: 'This is a sample test post.',
		});
	});

	beforeEach(() => {
		cy.deactivatePlugin(
			'custom-instant-results-template open-instant-results-with-buttons',
			'wpCli',
		);
		cy.login();
	});

	/**
	 * Test that the feature cannot be activated when not in ElasticPress.io nor using a custom PHP proxy.
	 */
	it("Can't activate the feature if not in ElasticPress.io nor using a custom PHP proxy", () => {
		if (isEpIo) {
			return;
		}

		// Make sure the proxy is deactivated.
		cy.deactivatePlugin('elasticpress-proxy');

		cy.visitAdminPage('admin.php?page=elasticpress');
		cy.get('.ep-feature-instant-results .settings-button').click();
		cy.get('.requirements-status-notice').should(
			'contain.text',
			'To use this feature you need to be an ElasticPress.io customer or implement a custom proxy',
		);
		cy.get('.ep-feature-instant-results .input-wrap').should('have.class', 'disabled');
	});

	describe('Instant Results Available', () => {
		before(() => {
			if (!isEpIo) {
				cy.activatePlugin('elasticpress-proxy');
			}
		});

		/**
		 * Test that the feature can be activated and it can sync automatically.
		 * Also, it can show a warning when using a custom PHP proxy
		 */
		it('Can activate the feature and sync automatically', () => {
			// Can see the warning if using custom proxy
			cy.visitAdminPage('admin.php?page=elasticpress');
			cy.get('.ep-feature-instant-results .settings-button').click();

			cy.get('.ep-feature-instant-results .input-wrap').should('not.have.class', 'disabled');
			cy.get('.requirements-status-notice').should(
				isEpIo ? 'not.contain.text' : 'contain.text',
				'You are using a custom proxy. Make sure you implement all security measures needed',
			);

			cy.get('.ep-feature-instant-results [name="settings[active]"][value="1"]').click();
			cy.get('.ep-feature-instant-results .button-primary').click();
			cy.on('window:confirm', () => {
				return true;
			});

			cy.get('.ep-sync-progress strong', {
				timeout: Cypress.config('elasticPressIndexTimeout'),
			}).should('contain.text', 'Sync complete');

			cy.wpCli('elasticpress list-features')
				.its('stdout')
				.should('contain', 'instant-results');
		});

		/**
		 * Test that the instant results list is visible
		 * It can display the number of test results
		 * It can show the modal in the same state after a reload
		 * Can change the URL when search term is changed
		 */
		it('Can see instant results elements, URL changes, reload, and update after changing search term', () => {
			cy.maybeEnableFeature('instant-results');

			cy.intercept('*search=blog*').as('apiRequest');

			cy.visit('/');

			cy.get('.wp-block-search').last().as('searchBlock');

			cy.get('@searchBlock').find('.wp-block-search__input').type('blog');
			cy.get('@searchBlock').find('.wp-block-search__button').click();
			cy.get('.ep-search-modal').as('searchModal').should('be.visible'); // Should be visible immediatly
			cy.url().should('include', 'search=blog');

			cy.wait('@apiRequest');
			cy.get('@searchModal').should('contain.text', 'blog');
			// Show the number of results
			cy.get('@searchModal').find('.ep-search-results__title').contains(/\d+/);

			cy.get('.ep-search-sidebar #ep-search-post-type-post')
				.click()
				.then(() => {
					cy.url().should('include', 'ep-post_type=post');
				});

			// Show the modal in the same state after a reload
			cy.reload();
			cy.wait('@apiRequest');
			cy.get('@searchModal').should('be.visible').should('contain.text', 'blog');

			// Update the results when search term is changed
			cy.get('@searchModal')
				.find('.ep-search-input')
				.clearThenType('test')
				.then(() => {
					cy.wait('@apiRequest');
					cy.get('@searchModal').should('be.visible').should('contain.text', 'test');
					cy.url().should('include', 'search=test');
				});

			cy.get('#wpadminbar li#wp-admin-bar-debug-bar').click();
			cy.get('#querylist').should('be.visible');
		});

		it('Is possible to manually open Instant Results with a plugin', () => {
			Cypress.on(
				'uncaught:exception',
				(err) => !err.message.includes('ResizeObserver loop limit exceeded'),
			);

			/**
			 * Activate test plugin with JavaScript.
			 */
			cy.maybeEnableFeature('instant-results');
			cy.activatePlugin('open-instant-results-with-buttons', 'wpCli');

			/**
			 * Create a post with a Buttons block.
			 */
			cy.publishPost({
				title: `Test openModal()`,
				content: 'Testing openModal()',
			});

			cy.openBlockInserter();
			cy.insertBlock('Buttons');
			cy.get('.wp-block-button__link').type('Search "Block"');

			/**
			 * Update the post and visit the front end.
			 */
			cy.get('.editor-post-publish-button__button').click();
			cy.get('.components-snackbar__action').click();

			/**
			 * Click the button.
			 */
			cy.intercept('*search=block*').as('apiRequest');
			cy.get('.wp-block-button__link').click();

			/**
			 * Instant Results should be open and populated with our search term.
			 */
			cy.wait('@apiRequest');
			cy.get('.ep-search-modal').as('searchModal').should('be.visible');
			cy.get('@searchModal').find('.ep-search-input').should('have.value', 'block');
			cy.get('@searchModal')
				.find('.ep-search-results__title')
				.should('contain.text', 'block');
		});

		it('Can filter the result template', () => {
			/**
			 * Activate test plugin with filter.
			 */
			cy.maybeEnableFeature('instant-results');
			cy.activatePlugin('custom-instant-results-template', 'wpCli');

			/**
			 * Perform a search.
			 */
			cy.intercept('*search=blog*').as('apiRequest');
			cy.visit('/');
			cy.get('.wp-block-search').last().as('searchBlock');
			cy.get('@searchBlock').find('input[type="search"]').type('blog');
			cy.get('@searchBlock').find('button').click();
			cy.get('.ep-search-modal').should('be.visible');
			cy.wait('@apiRequest');

			/**
			 * Results should use the filtered template with a custom class.
			 */
			cy.get('.my-custom-result').should('exist');
			cy.get('.ep-search-result').should('not.exist');
		});
	});
});
