import React, { Component } from "react";
import Icon from "bee-icon";
import Input from "bee-form-control";

export default class InputRender extends Component {
  state = {
    value: this.props.value,
    editable: false
  };
  handleChange = e => {
    const value = e;
    this.setState({ value });
  };
  check = () => {
    this.setState({ editable: false });
    if (this.props.onChange) {
      this.props.onChange(this.state.value);
    }
  };
  edit = () => {
    this.setState({ editable: true });
  };
  handleKeydown = event => {
    if (event.keyCode == 13) {
      this.check();
    }
  };
  render() {
    const { value, editable } = this.state;
    let { isclickTrigger } = this.props;
    let cellContent = "";
    if (editable) {
      cellContent = isclickTrigger ? (
        <div className="editable-cell-input-wrapper">
          <Input
            onChange={this.handleChange}
            onKeyDown={this.handleKeydown}
            onBlur={this.check}
            autoFocus
            value={value}
          />
        </div>
      ) : (
        <div className="editable-cell-input-wrapper">
          <Input
            value={value}
            onChange={this.handleChange}
            onKeyDown={this.handleKeydown}
          />
          <Icon
            type="uf-correct"
            className="editable-cell-icon-check"
            onClick={this.check}
          />
        </div>
      );
    } else {
      cellContent = isclickTrigger ? (
        <div className="editable-cell-text-wrapper" onClick={this.edit}>
          {value || " "}
        </div>
      ) : (
        <div className="editable-cell-text-wrapper">
          {value || " "}
          <Icon
            type="uf-pencil"
            className="editable-cell-icon"
            onClick={this.edit}
          />
        </div>
      );
    }
    return <div className="editable-cell">{cellContent}</div>;
  }
}