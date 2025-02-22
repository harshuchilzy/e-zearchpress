<?php
/**
 * Test InderHelper class.
 *
 * @since 4.4.0
 * @package elasticpress
 */

namespace ElasticPressTest;

/**
 * InderHelper test class
 */
class TestIndexHelper extends BaseTestCase {
	/**
	 * Test get_index_default_per_page
	 *
	 * @group indexHelper
	 */
	public function testGetIndexDefaultPerPage() {
		$index_helper = \ElasticPress\IndexHelper::factory();

		/**
		 * Test the default value.
		 */
		$this->assertEquals( 350, $index_helper->get_index_default_per_page() );

		/**
		 * Test changing the option value (most likely how users will have this changed.)
		 */
		$change_via_option_filter = function() {
			return 10;
		};
		if ( defined( 'EP_IS_NETWORK' ) && EP_IS_NETWORK ) {
			add_filter( 'pre_site_option_ep_bulk_setting', $change_via_option_filter );
		} else {
			add_filter( 'pre_option_ep_bulk_setting', $change_via_option_filter );
		}
		$this->assertEquals( 10, $index_helper->get_index_default_per_page() );

		/**
		 * Test the `ep_index_default_per_page` filter.
		 */
		$change_via_ep_filter = function() {
			return 15;
		};
		add_filter( 'ep_index_default_per_page', $change_via_ep_filter );
		$this->assertEquals( 15, $index_helper->get_index_default_per_page() );
	}
}
