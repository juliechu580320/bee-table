import React, { Component } from 'react';
import PropTypes from 'prop-types';
import TableRow from './TableRow';
import TableHeader from './TableHeader';
import { measureScrollbar, debounce, warningOnce } from './utils';
import shallowequal from 'shallowequal';
import addEventListener from 'tinper-bee-core/lib/addEventListener';
import ColumnManager from './ColumnManager';
import createStore from './createStore';
import Loading from 'bee-loading';

const propTypes = {
    data: PropTypes.array,
    expandIconAsCell: PropTypes.bool,
    defaultExpandAllRows: PropTypes.bool,
    expandedRowKeys: PropTypes.array,
    defaultExpandedRowKeys: PropTypes.array,
    useFixedHeader: PropTypes.bool,
    columns: PropTypes.array,
    clsPrefix: PropTypes.string,
    bodyStyle: PropTypes.object,
    style: PropTypes.object,
    //特殊的渲染规则的key值
    rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
    rowClassName: PropTypes.func,
    expandedRowClassName: PropTypes.func,
    childrenColumnName: PropTypes.string,
    onExpand: PropTypes.func,
    onExpandedRowsChange: PropTypes.func,
    indentSize: PropTypes.number,
    onRowClick: PropTypes.func,
    onRowDoubleClick: PropTypes.func,
    expandIconColumnIndex: PropTypes.number,
    //是否显示表头
    showHeader: PropTypes.bool,
    title: PropTypes.func,
    footer: PropTypes.func,
    emptyText: PropTypes.func,
    scroll: PropTypes.object,
    rowRef: PropTypes.func,
    getBodyWrapper: PropTypes.func,
    children: PropTypes.node,

    draggable: PropTypes.bool,
};

const defaultProps = {
    data: [],
    useFixedHeader: false,
    expandIconAsCell: false,
    defaultExpandAllRows: false,
    defaultExpandedRowKeys: [],
    rowKey: 'key',
    rowClassName: () => '',
    expandedRowClassName: () => '',
    onExpand() {},
    onExpandedRowsChange() {},
    onRowClick() {},
    onRowDoubleClick() {},
    clsPrefix: 'u-table',
    bodyStyle: {},
    style: {},
    childrenColumnName: 'children',
    indentSize: 15,
    expandIconColumnIndex: 0,
    showHeader: true,
    scroll: {},
    rowRef: () => null,
    getBodyWrapper: body => body,
    emptyText: () => 'No Data',
};

class Table extends Component{
  constructor(props){
      super(props);
      let expandedRowKeys = [];
      let rows = [...props.data];
      this.columnManager = new ColumnManager(props.columns, props.children);
      this.store = createStore({ currentHoverKey: null });

      if (props.defaultExpandAllRows) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          expandedRowKeys.push(this.getRowKey(row, i));
          rows = rows.concat(row[props.childrenColumnName] || []);
        }
      } else {
        expandedRowKeys = props.expandedRowKeys || props.defaultExpandedRowKeys;
      }
      this.state = {
          expandedRowKeys,
          data: props.data,
          currentHoverKey: null,
          scrollPosition: 'left',
          fixedColumnsHeadRowsHeight: [],
          fixedColumnsBodyRowsHeight: [],
      }

    this.onExpandedRowsChange = this.onExpandedRowsChange.bind(this);
    this.onExpanded = this.onExpanded.bind(this);
    this.onRowDestroy = this.onRowDestroy.bind(this);
    this.getRowKey = this.getRowKey.bind(this);
    this.getExpandedRows = this.getExpandedRows.bind(this);
    this.getHeader = this.getHeader.bind(this);
    this.getHeaderRows = this.getHeaderRows.bind(this);
    this.getExpandedRow = this.getExpandedRow.bind(this);
    this.getRowsByData = this.getRowsByData.bind(this);
    this.getRows = this.getRows.bind(this);
    this.getColGroup = this.getColGroup.bind(this);
    this.getLeftFixedTable = this.getLeftFixedTable.bind(this);
    this.getRightFixedTable = this.getRightFixedTable.bind(this);
    this.getTable = this.getTable.bind(this);
    this.getTitle = this.getTitle.bind(this);
    this.getFooter = this.getFooter.bind(this);
    this.getEmptyText = this.getEmptyText.bind(this);
    this.getHeaderRowStyle = this.getHeaderRowStyle.bind(this);
    this.syncFixedTableRowHeight = this.syncFixedTableRowHeight.bind(this);
    this.resetScrollY = this.resetScrollY.bind(this);
    this.findExpandedRow = this.findExpandedRow.bind(this);
    this.isRowExpanded = this.isRowExpanded.bind(this);
    this.detectScrollTarget = this.detectScrollTarget.bind(this);
    this.handleBodyScroll = this.handleBodyScroll.bind(this);
    this.handleRowHover = this.handleRowHover.bind(this);

  }

  componentDidMount() {
    this.resetScrollY();
    if (this.columnManager.isAnyColumnsFixed()) {
      this.syncFixedTableRowHeight();
      this.resizeEvent = addEventListener(
        window, 'resize', debounce(this.syncFixedTableRowHeight, 150)
      );
    }
  }

  componentWillReceiveProps(nextProps) {
    if ('data' in nextProps) {
      this.setState({
        data: nextProps.data,
      });
      if (!nextProps.data || nextProps.data.length === 0) {
        this.resetScrollY();
      }
    }
    if ('expandedRowKeys' in nextProps) {
      this.setState({
        expandedRowKeys: nextProps.expandedRowKeys,
      });
    }
    if (nextProps.columns && nextProps.columns !== this.props.columns) {
      this.columnManager.reset(nextProps.columns);
    } else if (nextProps.children !== this.props.children) {
      this.columnManager.reset(null, nextProps.children);
    }
  }

  componentDidUpdate() {
    this.syncFixedTableRowHeight();
  }

  componentWillUnmount() {
    if (this.resizeEvent) {
      this.resizeEvent.remove();
    }
  }

  onExpandedRowsChange(expandedRowKeys) {
    if (!this.props.expandedRowKeys) {
      this.setState({ expandedRowKeys });
    }
    this.props.onExpandedRowsChange(expandedRowKeys);
  }

  onExpanded(expanded, record, index,e ) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const info = this.findExpandedRow(record);
    if (typeof info !== 'undefined' && !expanded) {
      this.onRowDestroy(record, index);
    } else if (!info && expanded) {
      const expandedRows = this.getExpandedRows().concat();
      expandedRows.push(this.getRowKey(record, index));
      this.onExpandedRowsChange(expandedRows);
    }
    this.props.onExpand(expanded, record);
  }

  onRowDestroy(record, rowIndex) {
    const expandedRows = this.getExpandedRows().concat();
    const rowKey = this.getRowKey(record, rowIndex);
    let index = -1;
    expandedRows.forEach((r, i) => {
      if (r === rowKey) {
        index = i;
      }
    });
    if (index !== -1) {
      expandedRows.splice(index, 1);
    }
    this.onExpandedRowsChange(expandedRows);
  }

  getRowKey(record, index) {
    const rowKey = this.props.rowKey;
    const key = (typeof rowKey === 'function') ?
      rowKey(record, index) : record[rowKey];
    warningOnce(
      key !== undefined,
      'Each record in table should have a unique `key` prop,' +
      'or set `rowKey` to an unique primary key.'
    );
    return key;
  }

  getExpandedRows() {
    return this.props.expandedRowKeys || this.state.expandedRowKeys;
  }

  getHeader(columns, fixed) {
    const { showHeader, expandIconAsCell, clsPrefix ,onDragStart,onDragEnter,onDragOver,onDrop,draggable,
      onMouseDown,onMouseMove,onMouseUp,dragborder,onThMouseMove,dragborderKey} = this.props;
    const rows = this.getHeaderRows(columns);
    if (expandIconAsCell && fixed !== 'right') {
      rows[0].unshift({
        key: 'u-table-expandIconAsCell',
        className: `${clsPrefix}-expand-icon-th`,
        title: '',
        rowSpan: rows.length,
      });
    }

    const trStyle = fixed ? this.getHeaderRowStyle(columns, rows) : null;
    let drop = draggable?{onDragStart,onDragOver,onDrop,onDragEnter,draggable}:{};
    let dragBorder = dragborder?{onMouseDown,onMouseMove,onMouseUp,dragborder,onThMouseMove,dragborderKey}:{};

    return showHeader ? (
      <TableHeader
        {...drop}
        {...dragBorder}
        clsPrefix={clsPrefix}
        rows={rows}
        rowStyle={trStyle}
      />
    ) : null;
  }

  getHeaderRows(columns, currentRow = 0, rows) {
    rows = rows || [];
    rows[currentRow] = rows[currentRow] || [];

    columns.forEach(column => {
      if (column.rowSpan && rows.length < column.rowSpan) {
        while (rows.length < column.rowSpan) {
          rows.push([]);
        }
      }
      const cell = {
        key: column.key,
        className: column.className || '',
        children: column.title,
        drgHover: column.drgHover,
        width:column.width
      };
      if(column.onHeadCellClick){
        cell.onClick = column.onHeadCellClick;
      }
      if (column.children) {
        this.getHeaderRows(column.children, currentRow + 1, rows);
      }
      if ('colSpan' in column) {
        cell.colSpan = column.colSpan;
      }
      if ('rowSpan' in column) {
        cell.rowSpan = column.rowSpan;
      }
      if (cell.colSpan !== 0) {
        rows[currentRow].push(cell);
      }
    });
    return rows.filter(row => row.length > 0);
  }

  getExpandedRow(key, content, visible, className, fixed) {
    const { clsPrefix, expandIconAsCell } = this.props;
    let colCount;
    if (fixed === 'left') {
      colCount = this.columnManager.leftLeafColumns().length;
    } else if (fixed === 'right') {
      colCount = this.columnManager.rightLeafColumns().length;
    } else {
      colCount = this.columnManager.leafColumns().length;
    }

    function contentContainer () {
      if(content && content.props && content.props.style){
          return (
              <div style={{height: content.props.style.height}}></div>
          )
      }else{
        return ' '
      }
    }

    const columns = [{
      key: 'extra-row',
      render: () => ({
        props: {
          colSpan: colCount,
        },
        children: fixed !== 'right' ? content : contentContainer(),
      }),
    }];
    if (expandIconAsCell && fixed !== 'right') {
      columns.unshift({
        key: 'expand-icon-placeholder',
        render: () => null,
      });
    }
    return (
      <TableRow
        columns={columns}
        visible={visible}
        className={className}
        key={`${key}-extra-row`}
        clsPrefix={`${clsPrefix}-expanded-row`}
        indent={1}
        expandable={false}
        store={this.store}
        dragborderKey={this.props.dragborderKey}
      />
    );
  }

  getRowsByData(data, visible, indent, columns, fixed) {
    const props = this.props;
    const childrenColumnName = props.childrenColumnName;
    const expandedRowRender = props.expandedRowRender;
    const expandRowByClick = props.expandRowByClick;
    const { fixedColumnsBodyRowsHeight } = this.state;
    let rst = [];
    let isHiddenExpandIcon;
    const rowClassName = props.rowClassName;
    const rowRef = props.rowRef;
    const expandedRowClassName = props.expandedRowClassName;
    const needIndentSpaced = props.data.some(record => record[childrenColumnName]);
    const onRowClick = props.onRowClick;
    const onRowDoubleClick = props.onRowDoubleClick;

    const expandIconAsCell = fixed !== 'right' ? props.expandIconAsCell : false;
    const expandIconColumnIndex = fixed !== 'right' ? props.expandIconColumnIndex : -1;

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const key = this.getRowKey(record, i);
      const childrenColumn = record[childrenColumnName];
      const isRowExpanded = this.isRowExpanded(record, i);
      let expandedRowContent;
      if (expandedRowRender && isRowExpanded) {
        expandedRowContent = expandedRowRender(record, i, indent);
      }
      //只有当使用expandedRowRender参数的时候才去识别isHiddenExpandIcon（隐藏行展开的icon）
      if(expandedRowRender && typeof props.haveExpandIcon == 'function'){
          isHiddenExpandIcon = props.haveExpandIcon(record, i);
      }
      const className = rowClassName(record, i, indent);

      const onHoverProps = {};
      if (this.columnManager.isAnyColumnsFixed()) {
        onHoverProps.onHover = this.handleRowHover;
      }

      const height = (fixed && fixedColumnsBodyRowsHeight[i]) ?
        fixedColumnsBodyRowsHeight[i] : null;


      let leafColumns;
      if (fixed === 'left') {
        leafColumns = this.columnManager.leftLeafColumns();
      } else if (fixed === 'right') {
        leafColumns = this.columnManager.rightLeafColumns();
      } else {
        leafColumns = this.columnManager.leafColumns();
      }
      
      
      rst.push(
        <TableRow
          indent={indent}
          indentSize={props.indentSize}
          needIndentSpaced={needIndentSpaced}
          className={className}
          record={record}
          expandIconAsCell={expandIconAsCell}
          onDestroy={this.onRowDestroy}
          index={i}
          visible={visible}
          expandRowByClick={expandRowByClick}
          onExpand={this.onExpanded}
          expandable={childrenColumn || expandedRowRender}
          expanded={isRowExpanded}
          clsPrefix={`${props.clsPrefix}-row`}
          childrenColumnName={childrenColumnName}
          columns={leafColumns}
          expandIconColumnIndex={expandIconColumnIndex}
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          height={height}
          isHiddenExpandIcon={isHiddenExpandIcon}
          {...onHoverProps}
          key={key}
          hoverKey={key}
          ref={rowRef}
          store={this.store}
        />
      );

      const subVisible = visible && isRowExpanded;

      if (expandedRowContent && isRowExpanded) {
        rst.push(this.getExpandedRow(
          key, expandedRowContent, subVisible, expandedRowClassName(record, i, indent), fixed
        ));
      }
      if (childrenColumn) {
        rst = rst.concat(this.getRowsByData(
          childrenColumn, subVisible, indent + 1, columns, fixed
        ));
      }
    }
    return rst;
  }

  getRows(columns, fixed) {
    return this.getRowsByData(this.state.data, true, 0, columns, fixed);
  }

  getColGroup(columns, fixed) {
    let cols = [];
    if (this.props.expandIconAsCell && fixed !== 'right') {
      cols.push(
        <col
          className={`${this.props.clsPrefix}-expand-icon-col`}
          key="u-table-expand-icon-col"
        />
      );
    }
    let leafColumns;
    if (fixed === 'left') {
      leafColumns = this.columnManager.leftLeafColumns();
    } else if (fixed === 'right') {
      leafColumns = this.columnManager.rightLeafColumns();
    } else {
      leafColumns = this.columnManager.leafColumns();
    }
    cols = cols.concat(leafColumns.map(c => {
      return <col key={c.key} style={{ width: c.width, minWidth: c.width }} />;
    }));
    return <colgroup>{cols}</colgroup>;
  }

  renderDragHideTable=()=>{
    const {columns,dragborder,dragborderKey} = this.props;
    if(!dragborder)return null;
    let sum = 0;
    return(<div id={`u-table-drag-hide-table-${dragborderKey}`} className={`${this.props.clsPrefix}-hiden-drag`} >
      {
        columns.map((da,i)=>{
          sum += da.width?da.width:0;
          return(<div className={`${this.props.clsPrefix}-hiden-drag-li`}  key={da+"_hiden_"+i} style={{left:sum+"px"}}></div>);
        })
      }
    </div>);
  }

  getLeftFixedTable() { 
    return this.getTable({
      columns: this.columnManager.leftColumns(),
      fixed: 'left',
    });
  }

  getRightFixedTable() {
    return this.getTable({
      columns: this.columnManager.rightColumns(),
      fixed: 'right',
    });
  }

  getTable(options = {}) {
    const { columns, fixed } = options;
    const { clsPrefix, scroll = {}, getBodyWrapper, footerScroll } = this.props;
    let { useFixedHeader } = this.props;
    const bodyStyle = { ...this.props.bodyStyle };
    const headStyle = {};

    let tableClassName = '';
    if (scroll.x || fixed) {
      tableClassName = `${clsPrefix}-fixed`;
      if(!footerScroll){
        bodyStyle.overflowX = bodyStyle.overflowX || 'auto';
      }
    }

    if (scroll.y) {
      // maxHeight will make fixed-Table scrolling not working
      // so we only set maxHeight to body-Table here
      if (fixed) {
        bodyStyle.height = bodyStyle.height || scroll.y;
      } else {
        bodyStyle.maxHeight = bodyStyle.maxHeight || scroll.y;
      }
      bodyStyle.overflowY = bodyStyle.overflowY || 'auto';
      useFixedHeader = true;

      // Add negative margin bottom for scroll bar overflow bug
      const scrollbarWidth = measureScrollbar();
      if (scrollbarWidth >= 0) {
        (fixed ? bodyStyle : headStyle).marginBottom = `-${scrollbarWidth}px`;
        (fixed ? bodyStyle : headStyle).paddingBottom = '0px';
      }
    }

    const renderTable = (hasHead = true, hasBody = true) => {
      const tableStyle = {};
      if (!fixed && scroll.x) {
        // not set width, then use content fixed width
        if (scroll.x === true) {
          tableStyle.tableLayout = 'fixed';
        } else {
          tableStyle.width = scroll.x;
        }
      }
      const tableBody = hasBody ? getBodyWrapper(
        <tbody className={`${clsPrefix}-tbody`}>
          {this.getRows(columns, fixed)}
        </tbody>
      ) : null;
      let _drag_class = this.props.dragborder?"table-drag-bordered":""
      return (
        <table className={` ${tableClassName} table table-bordered ${_drag_class} `} style={tableStyle}>
          {this.props.dragborder?null:this.getColGroup(columns, fixed)}
          {hasHead ? this.getHeader(columns, fixed) : null}
          {tableBody}
        </table>
      );
    };

    let headTable;

    if (useFixedHeader) {
      headTable = (
        <div
          className={`${clsPrefix}-header`}
          ref={fixed ? null : 'headTable'}
          style={headStyle}
          onMouseOver={this.detectScrollTarget}
          onTouchStart={this.detectScrollTarget}
          onScroll={this.handleBodyScroll}
        >
          {renderTable(true, false)}
        </div>
      );
    }
    let BodyTable = (
      <div
        className={`${clsPrefix}-body`}
        style={bodyStyle}
        ref="bodyTable"
        onMouseOver={this.detectScrollTarget}
        onTouchStart={this.detectScrollTarget}
        onScroll={this.handleBodyScroll}
      >
        {this.renderDragHideTable()}
        {renderTable(!useFixedHeader)}
      </div>
    );

    if (fixed && columns.length) {
      let refName;
      if (columns[0].fixed === 'left' || columns[0].fixed === true) {
        refName = 'fixedColumnsBodyLeft';
      } else if (columns[0].fixed === 'right') {
        refName = 'fixedColumnsBodyRight';
      }
      delete bodyStyle.overflowX;
      delete bodyStyle.overflowY;
      BodyTable = (
        <div
          className={`${clsPrefix}-body-outer`}
          style={{ ...bodyStyle }}
        >
          <div
            className={`${clsPrefix}-body-inner`}
            ref={refName}
            onMouseOver={this.detectScrollTarget}
            onTouchStart={this.detectScrollTarget}
            onScroll={this.handleBodyScroll}
          >
            {renderTable(!useFixedHeader)}
          </div>
        </div>
      );
    }

    return <span>{headTable}{BodyTable}</span>;
  }

  getTitle() {
    const { title, clsPrefix } = this.props;
    return title ? (
      <div className={`${clsPrefix}-title`}>
        {title(this.state.data)}
      </div>
    ) : null;
  }

  getFooter() {
    const { footer, clsPrefix } = this.props;
    return footer ? (
      <div className={`${clsPrefix}-footer`}>
        {footer(this.state.data)}
      </div>
    ) : null;
  }

  getEmptyText() {
    const { emptyText, clsPrefix, data } = this.props;
    return !data.length ? (
      <div className={`${clsPrefix}-placeholder`}>
        {emptyText()}
      </div>
    ) : null;
  }

  getHeaderRowStyle(columns, rows) {
    const { fixedColumnsHeadRowsHeight } = this.state;
    const headerHeight = fixedColumnsHeadRowsHeight[0];
    if (headerHeight && columns) {
      if (headerHeight === 'auto') {
        return { height: 'auto' };
      }
      return { height: headerHeight / rows.length };
    }
    return null;
  }

  syncFixedTableRowHeight() {
    const { clsPrefix } = this.props;
    const headRows = this.refs.headTable ?
            this.refs.headTable.querySelectorAll('thead') :
            this.refs.bodyTable.querySelectorAll('thead');
    const bodyRows = this.refs.bodyTable.querySelectorAll(`.${clsPrefix}-row`) || [];
    const fixedColumnsHeadRowsHeight = [].map.call(
      headRows, row => row.getBoundingClientRect().height || 'auto'
    );
    const fixedColumnsBodyRowsHeight = [].map.call(
      bodyRows, row => row.getBoundingClientRect().height || 'auto'
    );
    if (shallowequal(this.state.fixedColumnsHeadRowsHeight, fixedColumnsHeadRowsHeight) &&
        shallowequal(this.state.fixedColumnsBodyRowsHeight, fixedColumnsBodyRowsHeight)) {
      return;
    }
    this.setState({
      fixedColumnsHeadRowsHeight,
      fixedColumnsBodyRowsHeight,
    });
  }

  resetScrollY() {
    if (this.refs.headTable) {
      this.refs.headTable.scrollLeft = 0;
    }
    if (this.refs.bodyTable) {
      this.refs.bodyTable.scrollLeft = 0;
    }
  }

  findExpandedRow(record, index) {
    const rows = this.getExpandedRows().filter(i => i === this.getRowKey(record, index));
    return rows[0];
  }

  isRowExpanded(record, index) {
    return typeof this.findExpandedRow(record, index) !== 'undefined';
  }

  detectScrollTarget(e) {
    if (this.scrollTarget !== e.currentTarget) {
      this.scrollTarget = e.currentTarget;
    }
  }

  handleBodyScroll(e) {

    const { scroll = {} } = this.props;
    const { headTable, bodyTable, fixedColumnsBodyLeft, fixedColumnsBodyRight } = this.refs;
      // Prevent scrollTop setter trigger onScroll event
      // http://stackoverflow.com/q/1386696
      if (e.target !== this.scrollTarget && this.scrollTarget !== headTable) {
          return;
      }
    if (scroll.x && e.target.scrollLeft !== this.lastScrollLeft) {
      if (e.target === bodyTable && headTable) {
        headTable.scrollLeft = e.target.scrollLeft;
      } else if (e.target === headTable && bodyTable) {
        bodyTable.scrollLeft = e.target.scrollLeft;
      }
      if (e.target.scrollLeft === 0) {
        this.setState({ scrollPosition: 'left' });
      } else if (e.target.scrollLeft + 1 >=
        e.target.children[0].getBoundingClientRect().width -
        e.target.getBoundingClientRect().width) {
        this.setState({ scrollPosition: 'right' });
      } else if (this.state.scrollPosition !== 'middle') {
        this.setState({ scrollPosition: 'middle' });
      }
    }
    if (scroll.y) {
      if (fixedColumnsBodyLeft && e.target !== fixedColumnsBodyLeft) {
        fixedColumnsBodyLeft.scrollTop = e.target.scrollTop;
      }
      if (fixedColumnsBodyRight && e.target !== fixedColumnsBodyRight) {
        fixedColumnsBodyRight.scrollTop = e.target.scrollTop;
      }
      if (bodyTable && e.target !== bodyTable) {
        bodyTable.scrollTop = e.target.scrollTop;
      }
    }
    // Remember last scrollLeft for scroll direction detecting.
    this.lastScrollLeft = e.target.scrollLeft;
  }

  handleRowHover(isHover, key) {
    this.store.setState({
      currentHoverKey: isHover ? key : null,
    });
  }

  render() {
    const props = this.props;
    const clsPrefix = props.clsPrefix;

    let className = props.clsPrefix;
    if (props.className) {
      className += ` ${props.className}`;
    }
    if (props.useFixedHeader || (props.scroll && props.scroll.y)) {
      className += ` ${clsPrefix}-fixed-header`;
    }
    if(props.bordered){
      className += ` ${clsPrefix}-bordered`;
    }
    className += ` ${clsPrefix}-scroll-position-${this.state.scrollPosition}`;

    const isTableScroll = this.columnManager.isAnyColumnsFixed() ||
                          props.scroll.x ||
                          props.scroll.y;
    let loading = props.loading;
    if (typeof loading === 'boolean') {
      loading = {
        show: loading,
      };
    }
    return (
      <div className={className} style={props.style}>
        {this.getTitle()}
        <div className={`${clsPrefix}-content`}>
          {this.columnManager.isAnyColumnsLeftFixed() &&
          <div className={`${clsPrefix}-fixed-left`}>
            {this.getLeftFixedTable()}
          </div>}
          <div className={isTableScroll ? `${clsPrefix}-scroll` : ''}>
            {this.getTable({ columns: this.columnManager.groupedColumns() })}
            {this.getEmptyText()}
            {this.getFooter()}
          </div>
          {this.columnManager.isAnyColumnsRightFixed() &&
          <div className={`${clsPrefix}-fixed-right`}>
            {this.getRightFixedTable()}
          </div>}
        </div>
        <Loading
          container={this}
          {...loading} />
      </div>
    );
  }
};

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;

export default Table;
