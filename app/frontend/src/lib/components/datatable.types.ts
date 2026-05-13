/**
 * Column definition for the DataTable component.
 */
export interface Column<T> {
	/** Property name on T (used for sorting + default cell rendering) */
	key: string;
	/** Display header text */
	label: string;
	/** Enable sort on this column (default false) */
	sortable?: boolean;
	/** Custom sort comparator (a, b) => number; defaults to string/number compare */
	sortFn?: (a: T, b: T) => number;
	/** Extra classes on <th> */
	headerClass?: string;
	/** Extra classes on <td> */
	cellClass?: string;
	/** Include this field in text search (default true) */
	searchable?: boolean;
}
