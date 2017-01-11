import React, { PropTypes, Component } from 'react';
import objectPath from 'object-path';

const propTypes = {
    record: PropTypes.object,
    clsPrefix: PropTypes.string,
    index: PropTypes.number,
    indent: PropTypes.number,
    indentSize: PropTypes.number,
    column: PropTypes.object,
    expandIcon: PropTypes.node
};

class TableCell extends Component{
 constructor(props){
     super(props);
     this.isInvalidRenderCellText = this.isInvalidRenderCellText.bind(this);
     this.handleClick = this.handleClick.bind(this);
 }
  isInvalidRenderCellText(text) {
    return text && !React.isValidElement(text) &&
      Object.prototype.toString.call(text) === '[object Object]';
  }
  handleClick(e) {
    const { record, column: { onCellClick } } = this.props;
    if (onCellClick) {
      onCellClick(record, e);
    }
  }
  render() {
    const { record, indentSize, clsPrefix, indent,
            index, expandIcon, column } = this.props;
    const { dataIndex, render, className = '' } = column;

    let text = objectPath.get(record, dataIndex);
    let tdProps;
    let colSpan;
    let rowSpan;

    if (render) {
      text = render(text, record, index);
      if (this.isInvalidRenderCellText(text)) {
        tdProps = text.props || {};
        rowSpan = tdProps.rowSpan;
        colSpan = tdProps.colSpan;
        text = text.children;
      }
    }


    if (this.isInvalidRenderCellText(text)) {
      text = null;
    }

    const indentText = expandIcon ? (
      <span
        style={{ paddingLeft: `${indentSize * indent}px` }}
        className={`${clsPrefix}-indent indent-level-${indent}`}
      />
    ) : null;

    if (rowSpan === 0 || colSpan === 0) {
      return null;
    }
    return (
      <td
        colSpan={colSpan}
        rowSpan={rowSpan}
        className={className}
        onClick={this.handleClick}
      >
        {indentText}
        {expandIcon}
        {text}
      </td>
    );
  }
};

TableCell.propTypes = propTypes;

export default TableCell;