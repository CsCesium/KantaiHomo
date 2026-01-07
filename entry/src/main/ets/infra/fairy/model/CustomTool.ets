import { AttributeSet } from "./AttributeSet";
import { NumOffset } from "./NumOffset";
import { ToolInterface } from "./ToolInterface";

export class CustomTool {
  constructor(
    builder: WrappedBuilder<[ToolInterface]>,
    offset: NumOffset,
    cornerOffset: NumOffset,
    attributeSet: AttributeSet
  ) {
    this._builder = builder;
    this._offset = offset;
    this._cornerOffset = cornerOffset;
    this._attributeSet = attributeSet;
  }

  private _builder: WrappedBuilder<[ToolInterface]>;

  public get builder(): WrappedBuilder<[ToolInterface]> {
    return this._builder;
  }

  private _offset: NumOffset;

  public get offset(): NumOffset {
    return this._offset;
  }

  private _cornerOffset: NumOffset;

  public get cornerOffset(): NumOffset {
    return this._cornerOffset;
  }

  private _attributeSet: AttributeSet;

  public get attributeSet(): AttributeSet {
    return this._attributeSet;
  }
}